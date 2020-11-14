/**
 * Handling importing of data from the new site,
 * either via string or from the local storage.
 *
 * Includes migration handling and recovery states.
 */

import localStorage from './local-storage';

import { fromBase64, getUnixTimestamp, reloadWindow } from '../Util';

import { LOCAL_STORAGE_KEY_RECOVERY, PREFERENCES_PREFIX } from './DefaultPreferences';

/**
 * When attempting to import data, via string or via local storage,
 * if the migration fails, we store data about the failure in local storage as well.
 */
const storeRecoveryData = (json, message) => {
  console.warn(`Storing data in recovery (version ${json?.version ?? '<BAD VERSION>'})`);

  // Look for the first unused recovery value.
  let counter = 1;
  let sentinel = false;
  do {
    if (!localStorage.get(LOCAL_STORAGE_KEY_RECOVERY.replace('%COUNTER%', counter))) {
      sentinel = true;
    } else {
      counter += 1;
    }
  } while (!sentinel);

  // Store in the first unused recovery value.
  localStorage.set(LOCAL_STORAGE_KEY_RECOVERY.replace('%COUNTER%', counter), {
    json,
    message,
    version: json?.version ?? '<BAD VERSION>',
    timestamp: getUnixTimestamp(),
  });
};

/**
 * Migrate data if it is an older version, and throw an error for an invalid version..
 * @param {*} input The JSON data.
 * @param {*} version The version prefix.
 */
export const migrateData = (input, version) => {
  // eslint-disable-next-line prefer-const
  let output = input;

  switch (version) {
    default:
      console.error(`[ERROR] Could not identify preferences prefix ${version}`);
      storeRecoveryData(input, `[ERROR] Could not identify preferences prefix ${version}`);
      return null;
    // Make it look like:
    // case GM_001: <code to mutate output> from 001 to 002, fallthrough, GM_002: Return
    case 'GM_001':
      return output;
  }
};

/**
 * Import data from a current or former version of GenshinMap via string.
 * @param {*} input The input string.
 * @param {*} setMapPreferences The function to set the map preferences state.
 */
export const importDataFromString = (input, setMapPreferences) => {
  try {
    const decodedData = fromBase64(input);

    const versionPrefix = decodedData.substring(0, PREFERENCES_PREFIX.length);

    const jsonData = JSON.parse(decodedData.substring(PREFERENCES_PREFIX.length));

    const migratedData = migrateData(jsonData, versionPrefix);

    if (migratedData == null) return;

    // Set the data.
    setMapPreferences((old) => ({ ...old, ...jsonData }));
    // Data change requires a page reload.
    reloadWindow();
  } catch (err) {
    if (err.name === 'InvalidCharacterError') {
      // There was an invalid character in the import string.
      console.error('[ERROR] Invalid character in import string. Check the format and try again.');
    } else {
      console.error(err);
    }
  }
};