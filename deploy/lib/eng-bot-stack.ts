import { Stack, StackProps, Duration } from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Function, Code, Runtime } from 'aws-cdk-lib/aws-lambda'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { HttpApi, HttpMethod } from '@aws-cdk/aws-apigatewayv2-alpha'
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import { Construct } from 'constructs'
import path = require('path')

export class EngBotStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props)

        const usersTable = new dynamodb.Table(this, 'EngBotUsersTable', {
            partitionKey: {
                name: 'chatId',
                type: dynamodb.AttributeType.STRING,
            },
            tableName: 'EngBotUsers',
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        })
        const correctionsTable = new dynamodb.Table(this, 'EngBotCorrectionsTable', {
            partitionKey: {
                name: 'chatId',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'id',
                type: dynamodb.AttributeType.STRING,
            },
            tableName: 'EngBotCorrections',
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        })
        const correctionsIndex = correctionsTable.addLocalSecondaryIndex({
            indexName: 'correctionIndex',
            sortKey: {
                name: 'id',
                type: dynamodb.AttributeType.STRING,
            },
        })

        const bot = new Function(this, 'eng-bot', {
            runtime: Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: Code.fromAsset(path.resolve('..', 'bot', 'dist', 'bot.zip')),
            timeout: Duration.seconds(60),
            environment: {
                LOG_LEVEL: 'debug',
                USERS_TABLE: usersTable.tableName,
                CORRECTIONS_TABLE: correctionsTable.tableName,
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

        bot.addToRolePolicy(
            new iam.PolicyStatement({
                actions: [
                    'dynamodb:PutItem',
                    'dynamodb:UpdateItem',
                    'dynamodb:Query',
                    'dynamodb:GetItem',
                ],
                resources: [usersTable.tableArn],
            })
        )

        bot.addToRolePolicy(
            new iam.PolicyStatement({
                actions: [
                    'dynamodb:PutItem',
                    'dynamodb:UpdateItem',
                    'dynamodb:Query',
                    'dynamodb:GetItem',
                ],
                resources: [correctionsTable.tableArn],
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
