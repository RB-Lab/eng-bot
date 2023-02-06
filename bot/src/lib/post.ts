import * as https from 'https'
import { getSecrets } from './secret-service'

export async function post(url: URL, data: Object) {
    const { botToken } = await getSecrets()
    
    console.log('[POST]', url.href.replace(botToken, '****'), data)

    return new Promise((resolve, reject) => {
        const json = JSON.stringify(data)
        const options = {
            host: url.host,
            port: 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': json.length,
            },
        }

        var req = https.request(options, (res) => {
            res.setEncoding('utf8')
            let result = ''
            res.on('data', (chunk) => {
                result += chunk
            })
            res.on('end', () => {
                if (res.headers['content-type'] === 'application/json') {
                    resolve(JSON.parse(result))
                } else {
                    resolve(result)
                }
            })
        })

        req.on('error', (e) => {
            reject(e)
        })

        // write data to request body
        req.write(json)
        req.end()
    })
}
