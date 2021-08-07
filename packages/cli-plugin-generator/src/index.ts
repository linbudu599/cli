import { BasePlugin } from '@midwayjs/command-core';
import consola from 'consola';
import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  mountControllerCommand,
  controllerHandler,
} from './core/internal/controller.handler';
import {
  mountServiceCommand,
  serviceHandler,
} from './core/internal/service.handler';
import {
  mountMiddlewareCommand,
  middlewareHandler,
} from './core/internal/middleware.handler';
import {
  mountServerlessCommand,
  serverlessHandler,
} from './core/internal/serverless.handler';

import {
  mountORMCommand,
  ormHandler,
  TypeORMGeneratorType,
} from './core/external/orm.handler';
import { mountDebugCommand, debugHandler } from './core/internal/debug.handler';
import { mountAxiosCommand, axiosHandler } from './core/external/axios.handler';
import { mountCacheCommand, cacheHandler } from './core/external/cache.handler';
import { mountOSSCommand, ossHandler } from './core/external/oss.handler';
import {
  mountSwaggerCommand,
  swaggerHandler,
} from './core/external/swagger.handler';
import {
  mountWebSocketCommand,
  webSocketHandler,
  WebSocketGeneratorType,
} from './core/external/websocket.handler';

// midway-bin gen -> prompt

export class GeneratorPlugin extends BasePlugin {
  commands = {
    gen: {
      usage: 'generator tmp',
      lifecycleEvents: ['gen'],
      commands: {
        // internal
        ...mountControllerCommand(),
        ...mountServiceCommand(),
        ...mountDebugCommand(),
        ...mountMiddlewareCommand(),
        ...mountServerlessCommand(),
        // external
        ...mountORMCommand(),
        ...mountAxiosCommand(),
        ...mountCacheCommand(),
        ...mountOSSCommand(),
        ...mountSwaggerCommand(),
        ...mountWebSocketCommand(),
      },
    },
  };

  hooks = {
    // entry
    'gen:gen': this.noGeneratorSpecifiedHandler.bind(this),
    // internal
    'gen:controller:gen': this.controllerHandler.bind(this),
    'gen:service:gen': this.serviceHandler.bind(this),
    'gen:debug:gen': this.debugHandler.bind(this),
    'gen:middleware:gen': this.middlewareHandler.bind(this),
    'gen:sls:gen': this.serverlessHandler.bind(this),

    // external
    // orm
    'gen:orm:gen': this.ormHandler.bind(this),
    'gen:orm:setup:gen': this.ormHandler.bind(this, TypeORMGeneratorType.SETUP),
    'gen:orm:entity:gen': this.ormHandler.bind(
      this,
      TypeORMGeneratorType.ENTITY
    ),
    'gen:orm:subscriber:gen': this.ormHandler.bind(
      this,
      TypeORMGeneratorType.SUBSCRIBER
    ),
    // axios
    'gen:axios:gen': this.axiosHandler.bind(this),
    // cache
    'gen:cache:gen': this.cacheHandler.bind(this),
    // oss
    'gen:oss:gen': this.ossHandler.bind(this),
    // swagger
    'gen:swagger:gen': this.swaggerHandler.bind(this),
    // web socket
    'gen:ws:gen': this.webSocketHandler.bind(this),
    'gen:ws:setup:gen': this.webSocketHandler.bind(
      this,
      WebSocketGeneratorType.SETUP
    ),
    'gen:ws:controller:gen': this.webSocketHandler.bind(
      this,
      WebSocketGeneratorType.Controller
    ),
  };

  async controllerHandler() {
    await controllerHandler(this.core, this.options);
  }

  async serviceHandler() {
    await serviceHandler(this.core, this.options);
  }

  async debugHandler() {
    await debugHandler(this.core, this.options);
  }

  async middlewareHandler() {
    await middlewareHandler(this.core, this.options);
  }

  async serverlessHandler() {
    await serverlessHandler(this.core, this.options);
  }

  async ormHandler(type?: TypeORMGeneratorType) {
    await ormHandler(this.core, this.options, type);
  }

  async axiosHandler() {
    await axiosHandler(this.core, this.options);
  }

  async cacheHandler() {
    await cacheHandler(this.core, this.options);
  }

  async ossHandler() {
    await ossHandler(this.core, this.options);
  }

  async swaggerHandler() {
    await swaggerHandler(this.core, this.options);
  }

  async webSocketHandler(type?: WebSocketGeneratorType) {
    await webSocketHandler(this.core, this.options, type);
  }

  async noGeneratorSpecifiedHandler() {
    const promptedType = await inquirer.prompt([
      {
        name: 'type',
        type: 'list',
        loop: true,
        choices: ['controller', 'orm'],
      },
    ]);

    consola.success(`Invoking Generator: ${chalk.cyan(promptedType.type)}`);

    switch (promptedType.type) {
      case 'controller':
        await this.controllerHandler();
        break;
      case 'orm':
        await this.ormHandler();
        break;
    }
  }
}
