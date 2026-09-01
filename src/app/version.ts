/**
 * The published version of this application.
 *
 * Kept beside the code rather than read from package.json: importing JSON into
 * the application bundle to show one string is a build setting that surprises
 * whoever comes next. The cost is that the two can drift, so a test reads the
 * manifest and checks they have not — with JSON imports turned on for the tests
 * only, where nothing ships.
 */
export const VERSION = '1.0.0';
