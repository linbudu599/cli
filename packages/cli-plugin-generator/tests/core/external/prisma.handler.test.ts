import fs from 'fs-extra';
import jsonfile from 'jsonfile';
import {
  resetFixtures,
  createGeneratorCommand,
  configPath,
  configurationPath,
  packagePath,
  baseDir,
} from '../../shared';
import { AXIOS_DEP } from '../../../src/core/external/axios.handler';

describe.skip('Prisma handler', () => {
  beforeAll(() => {
    jest.setTimeout(300000);
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  it('should install required deps only', async () => {});
});