import * as https from 'https'
import { log } from './log'
// @ts-ignore
// import fetch from 'node-fetch'

export async function post(botToken: string, url: URL, data: Object) {
    log.debug('[POST]', url.href.replace(botToken, '****'), data)

    // const cfg = {
    //     method: 'POST',
    //     headers: { 'content-type': 'application/json', connection: 'keep-alive' },
    //     body: JSON.stringify(data),
    //   }
    //   return  fetch(url, cfg)

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
