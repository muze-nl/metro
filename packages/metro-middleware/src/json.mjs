export default function jsonmw(options)
{
    options = Object.assign({
        contentType: 'application/json',
        reviver: null,
        replacer: null,
        space: ''
    }, options)

    return async function json(req, next) {
        if (!req.headers.get('Accept')) {
            req = req.with({
                headers: {
                    'Accept': options.accept ?? options.contentType
                }
            })
        }
        if (req.method!=='GET' && req.method!=='HEAD') {
            //https://developer.mozilla.org/en-US/docs/Web/API/Request/body
            if (req.data && typeof req.data=='object' && !(req.data instanceof ReadableStream)) {
                const contentType = req.headers.get('Content-Type')
                if (!contentType || isPlainText(contentType)) {
                    req = req.with({
                        headers: {
                            'Content-Type':options.contentType,
                        }
                    })
                }
                if (isJSON(req.headers.get('Content-Type'))) {
                    req = req.with({
                        body: JSON.stringify(req.data, options.replacer, options.space)
                    })
                }
            }
        }
        let res = await next(req)
        if (res && isJSON(res.headers?.get('Content-Type'))) {
            let tempRes = res.clone()
            let body = await tempRes.text()
            if (body === '') {
                // e.g. 204 No Content or HEAD: there is no JSON to parse
                return res
            }
            try {
                let json = JSON.parse(body, options.reviver)
                return res.with({
                    body: json
                })
            }
            catch(error) {
                // the status already reports an HTTP failure, so an
                // unparseable error body is left as text
                if (!res.ok) {
                    return res
                }
                throw parseError(req, res, error)
            }
        }
        return res
    }
}

/**
 * The error's cause is the JSON.parse error. The request and the unparsed
 * response remain available for inspection.
 */
function parseError(req, res, cause)
{
    const message = 'jsonmw: could not parse '
        + res.headers.get('Content-Type') + ' response from ' + req.url
    const error = new Error(message, { cause })
    error.request = req
    error.response = res
    return error
}

/*
  this matches:
  - application/json
  - application/ld+json
  - application/json; charset=utf-8
  - application/ld+json; charset=utf-8
*/
const jsonRE = /^application\/([a-zA-Z0-9\-_]+\+)?json\b/
function isJSON(contentType)
{
    return jsonRE.exec(contentType)
}

function isPlainText(contentType)
{
    return /^text\/plain\b/.exec(contentType)
}