import {
    SecretsManagerClient,
    GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager'

const secretsManager = new SecretsManagerClient({
    region: 'eu-central-1',
})

let tokens: null | {[key: string]: string} = null

export async function getSecrets(){
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
            console.error('[ERROR]', 'cannot parse tokens', tokens_.SecretString)
            throw e
        }
    }
    if(!tokens){
        throw new Error('cannot parse tokens')
    }
    return {
        botToken: tokens['bot-token'],
        callbackToken: tokens['callback-token'],
        openApiToken: tokens['open-api-token'],
    }
}