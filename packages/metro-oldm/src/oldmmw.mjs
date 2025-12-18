import oldm from '@muze-nl/oldm'

export default function oldmmw(options)
{
	options = Object.assign({
		contentType: 'text/turtle',
		prefixes: {
		    'ldp':    'http://www.w3.org/ns/ldp#',
		    'rdf':    'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
		    'dct':    'http://purl.org/dc/terms/',
		    'stat':   'http://www.w3.org/ns/posix/stat#',
		    'turtle': 'http://www.w3.org/ns/iana/media-types/text/turtle#',
		    'schem':  'https://schema.org/',
		    'solid':  'http://www.w3.org/ns/solid/terms#',
		    'acl':    'http://www.w3.org/ns/auth/acl#',
		    'pims':   'http://www.w3.org/ns/pim/space#',
		    'vcard':  'http://www.w3.org/2006/vcard/ns#',
		    'foaf':   'http://xmlns.com/foaf/0.1/'
		},
		parser: oldm.n3Parser,
		writer: oldm.n3Writer
	}, options)

	if (!options.prefixes['ldp']) {
		options.prefixes['ldp'] = 'http://www.w3.org/ns/ldp#'
	}

	const context = oldm(options)

	return async function oldmmw(req, next) {
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
                            'Content-Type': options.contentType,
                        }
                    })
                }
                if (isLinkedData(req.headers.get('Content-Type'))) {
                    req = req.with({
                        body: await context.writer(req.data)
                    })
                }
            }
        }
        let res = await next(req)        
	}
}