/**
 * The version on screen and the version published have to be the same number.
 *
 * The application shows one under the unlock card. It is declared in the code
 * rather than read from the package manifest, because importing JSON into the
 * bundle to show one string is a build setting that surprises whoever comes
 * next. The cost of that choice is that the two can drift, so this is what
 * stops them.
 */
import packageJson from '../../package.json';

import { VERSION } from './version';

describe('the version shown to the reader', () => {
  it('is the version this package publishes', () => {
    expect(VERSION).toBe(packageJson.version);
  });
});
