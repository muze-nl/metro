export { default as json } from './json.mjs'
export { default as thrower } from './thrower.mjs'
export { default as getdata } from './getdata.mjs'
export { default as retry } from './retry.mjs'
export { default as timeout } from './timeout.mjs'
export { default as abort } from './abort.mjs'
export { default as backoff } from './backoff.mjs'
export { default as echoMock } from './echo.mock.mjs'
export { default as errorMock } from './error.mock.mjs'

import json from './json.mjs'
import thrower from './thrower.mjs'
import getdata from './getdata.mjs'
import retry from './retry.mjs'
import timeout from './timeout.mjs'
import abort from './abort.mjs'
import backoff from './backoff.mjs'
import echoMock from './echo.mock.mjs'
import errorMock from './error.mock.mjs'

export default {
	json,
	thrower,
	getdata,
	retry,
	timeout,
	abort,
	backoff,
	echoMock,
	errorMock
}
