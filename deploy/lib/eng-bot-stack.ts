import { Stack, StackProps, Duration } from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Function, Code, Runtime } from 'aws-cdk-lib/aws-lambda'
import { HttpApi, HttpMethod } from '@aws-cdk/aws-apigatewayv2-alpha'
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import { Construct } from 'constructs'
import path = require('path')

export class EngBotStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props)

        const bot = new Function(this, 'eng-bot', {
            runtime: Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: Code.fromAsset(path.resolve('..', 'bot', 'dist', 'bot.zip')),
            timeout: Duration.seconds(60),
            environment: {
                LOG_LEVEL: 'debug',
            },
        })
        // add bot function permissions to secrets manager
        bot.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['secretsmanager:GetSecretValue'],
                resources: [
                    'arn:aws:secretsmanager:eu-central-1:296292975264:secret:eng-bot-tokens-2BPbQd',
                ],
            })
        )

        const httpApi = new HttpApi(this, 'EngBotApi', {
            description: 'HTTP API',
        })

        httpApi.addRoutes({
            path: '/callback',
            methods: [HttpMethod.POST],
            integration: new HttpLambdaIntegration('BotIntegration', bot),
        })
    }
}
