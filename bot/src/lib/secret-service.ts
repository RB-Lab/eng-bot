import {
    SecretsManagerClient,
    GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager'
import { log } from './log'

const secretsManager = new SecretsManagerClient({
    region: 'eu-central-1',
})

let tokens: null | {[key: string]: string} = null

export async function getSecrets(){
    log.debug('getting tokens')
    if(!tokens){
        const tokens_ = await secretsManager.send(
            new GetSecretValueCommand({
                SecretId: 'eng-bot-tokens',
                VersionStage: 'AWSCURRENT',
            })
        )
        try{
            if(!tokens_.SecretString) throw new Error('No tokens in SecretString')
            tokens = JSON.parse(tokens_.SecretString || '{}')
        } catch (e) {
            log.error('cannot parse tokens', tokens_.SecretString)
            throw e
        }
    }
    if(!tokens){
        throw new Error('cannot parse tokens')
    }
    log.debug('got tokens')
    return {
        botToken: tokens['bot-token'],
        callbackToken: tokens['callback-token'],
        openApiToken: tokens['open-api-token'],
    }
}