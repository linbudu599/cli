import { BasePlugin } from '@midwayjs/command-core';
import { RunnerContainer, Runner } from '@midwayjs/luckyeye';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import * as chalk from 'chalk';
import * as YAML from 'js-yaml';

enum ProjectType {
  FaaS = 'faas',
}

const CHECK_SKIP = 'check_skip';

enum CHECK_COLOR {
  GROUP = '#e5e511',
  ERROR = '#f55111',
  SUCCESS = '#23d18b',
  SKIP = '#999999',
}

type RunnerItem = (runner: Runner) => void;

export class CheckPlugin extends BasePlugin {
  projectType: ProjectType;
  currentGroup: string;

  errors = [];

  commands = {
    check: {
      usage: 'find your code bugs',
      lifecycleEvents: ['start', 'check', 'output'],
    },
  };

  hooks = {
    'check:start': this.start.bind(this),
    'check:check': this.check.bind(this),
  };

  async start() {
    // check project type
    const fyml = this.getYamlFilePosition();
    if (existsSync(fyml)) {
      const yamlData = readFileSync(fyml).toString();
      if (!/deployType/.test(yamlData)) {
        this.projectType = ProjectType.FaaS;
      }
    }
  }

  async check() {
    const container = new RunnerContainer();
    container.loadRulePackage();
    container.registerReport(this.getCheckReporter());
    const ruleList = await this.getRuleList();
    for (const rule of ruleList) {
      container.addRule(rule);
    }
    await container.run();
  }

  async getRuleList(): Promise<Array<RunnerItem>> {
    const ruleList: RunnerItem[] = [];
    if (this.options.checkRule) {
      const ruleList = [].concat(this.options.checkRule);
      for (const getRule of ruleList) {
        const rule = await getRule();
        ruleList.push(rule);
      }
    }

    if (this.projectType === ProjectType.FaaS) {
      ruleList.push(
        await this.ruleFaaSDecorator(),
        this.ruleFYaml(),
        this.ruleTSConfig()
      );
    }

    return ruleList;
  }

  async ruleFaaSDecorator(): Promise<RunnerItem> {
    // 校验是否存在 decorator 重名
    // 校验 @Logger 装饰器所在class是否被继承
    return runner => {};
  }

  // 校验yaml格式
  ruleFYaml(): RunnerItem {
    // yaml 配置
    const yamlFile = join(this.core.cwd, 'f.yml');
    let yamlObj;
    let error;
    try {
      const contents = readFileSync(yamlFile).toString();
      yamlObj = YAML.load(contents.toString(), {});
    } catch (exception) {
      error = exception;
    }
    return runner => {
      runner
        .group('f.yml check')
        .check('format', () => {
          if (error) {
            return [false, 'Yaml format error: ' + error.message];
          }
          return [true];
        })
        .check('service', () => {
          if (!yamlObj?.service) {
            return [false, 'need service config'];
          }
          return [true];
        })
        .check('provider', () => {
          if (!yamlObj?.provider) {
            return [false, 'need provider config'];
          }
          if (!yamlObj?.provider?.name) {
            return [false, 'need provider name, e.g. aliyun'];
          }
          return [true];
        })
        .check('trigger list', () => {
          if (!yamlObj?.functions) {
            return [CHECK_SKIP];
          }

          const allFunc = Object.keys(yamlObj.functions);
          for (const funcName of allFunc) {
            const funcInfo = yamlObj.functions[funcName];
            // 允许无触发器配置
            if (!funcInfo.events) {
              continue;
            }
            if (!Array.isArray(funcInfo.events)) {
              return [false, `function '${funcName}' events type need array`];
            }
          }
          return [true];
        })
        .check('http trigger', () => {
          if (!yamlObj?.functions) {
            return [CHECK_SKIP];
          }

          const allFunc = Object.keys(yamlObj.functions);
          for (const funcName of allFunc) {
            const funcInfo = yamlObj.functions[funcName];
            if (!funcInfo.events || !Array.isArray(funcInfo.events)) {
              continue;
            }
            const httpTriggers = funcInfo.events.filter(event => {
              return event?.http || event?.apigw;
            });

            if (!httpTriggers.length) {
              continue;
            }

            for (const httpTrigger of httpTriggers) {
              const triggerInfo = httpTrigger.http || httpTrigger.apigw;
              if (!triggerInfo.path) {
                return [false, `function '${funcName}' http trigger need path`];
              }
              if (triggerInfo.method && !Array.isArray(triggerInfo.method)) {
                return [
                  false,
                  `function '${funcName}' http trigger method type need array`,
                ];
              }
            }
          }
          return [true];
        })
        .check('package in/exclude type', () => {
          if (!yamlObj?.package) {
            return [CHECK_SKIP];
          }

          if (
            yamlObj.package.include &&
            !Array.isArray(yamlObj.package.include)
          ) {
            return [false, 'package include type need array'];
          }

          if (
            yamlObj.package.exclude &&
            !Array.isArray(yamlObj.package.exclude)
          ) {
            return [false, 'package exclude type need array'];
          }
          return [true];
        });
    };
  }

  ruleTSConfig(): RunnerItem {
    const tsConfigFile = join(this.core.cwd, 'tsconfig.json');
    const exists = existsSync(tsConfigFile);
    let tsconfig;
    return runner => {
      runner
        .group('tsconfig check')
        .check('exists', () => {
          if (!exists) {
            return [false, 'tsconfig.json not exists'];
          }
          return [true];
        })
        .check('parse', () => {
          if (!exists) {
            return [CHECK_SKIP];
          }
          try {
            tsconfig = JSON.parse(readFileSync(tsConfigFile).toString());
          } catch (e) {
            return [false, 'tsconfig parse error: ' + e.message];
          }
          return [true];
        })
        .check('compiler target', () => {
          const target = tsconfig?.compilerOptions?.target;
          if (!target) {
            return [CHECK_SKIP];
          }
          const targetMap = {
            es3: 3,
            es5: 5,
            es6: 6,
            es7: 7,
            es2015: 6,
            es2016: 7,
            es2017: 8,
            es2018: 9,
            es2019: 10,
            es2020: 11,
            es2021: 12,
            esnext: 12,
          };
          const targetVersion =
            targetMap[target.toLowerCase().replace(/\s+/g, '')];
          if (!targetVersion) {
            return [
              false,
              `tsconfig target version '${targetVersion}' not support`,
            ];
          } else if (targetVersion > 9) {
            return [false, 'tsconfig target need ≤ es2018'];
          }
          return [true];
        });
    };
  }

  private getCheckReporter() {
    return {
      reportGroup: data => {
        this.currentGroup = data.group;
        this.checkReporterOutput();
        this.checkReporterOutput({
          msg: data.group,
          prefix: '◎',
          color: CHECK_COLOR.GROUP,
        });
        this.checkReporterOutput();
      },
      reportCheck: data => {
        if (data.message === CHECK_SKIP) {
          this.core.debug('skip check', this.currentGroup, data.title);
        } else if (data.message) {
          this.checkReporterOutput({
            msg: data.title,
            prefix: '✔',
            color: CHECK_COLOR.SUCCESS,
            ident: 1,
          });
        } else {
          this.errors.push({
            group: this.currentGroup,
            title: data.title,
            message: data.result,
          });
          this.checkReporterOutput({
            msg: data.title,
            prefix: '✗',
            color: CHECK_COLOR.ERROR,
            ident: 1,
          });
        }
      },
      reportEnd: () => {
        if (this.errors.length) {
          this.checkReporterOutput();
          this.checkReporterOutput({
            msg: 'Check Not Passed:',
            color: CHECK_COLOR.ERROR,
          });
          let i = 1;
          for (const error of this.errors) {
            this.checkReporterOutput({
              msg: `${i++}. ${error.message} [ ${error.group} ]`,
              color: CHECK_COLOR.ERROR,
              ident: 1,
            });
          }
        } else {
          this.checkReporterOutput();
          this.checkReporterOutput({
            msg: 'All Check Passed',
            color: CHECK_COLOR.SUCCESS,
          });
        }
      },
      reportStart: () => {},
      reportInfo: () => {},
      reportSkip: () => {},
    };
  }

  private checkReporterOutput(
    message?:
      | string
      | { msg: string; color?: CHECK_COLOR; prefix?: string; ident?: number }
  ) {
    if (!message) {
      message = {
        msg: '',
      };
    } else if (typeof message === 'string') {
      message = {
        msg: message,
      };
    }

    let msg = message.msg || '';

    if (message.prefix) {
      msg = message.prefix + ' ' + msg;
    }

    if (message.ident) {
      msg = Array(message.ident).fill(' ').join(' ') + msg;
    }
    if (message.color) {
      msg = chalk.hex(message.color)(msg);
    }

    this.core.cli.log(msg);
  }

  private getYamlFilePosition() {
    return join(this.core.cwd, 'f.yml');
  }
}
