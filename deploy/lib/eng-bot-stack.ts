import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Function, Code, Runtime } from 'aws-cdk-lib/aws-lambda'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import { HttpApi, HttpMethod } from '@aws-cdk/aws-apigatewayv2-alpha'
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import { Construct } from 'constructs'
import path = require('path')


const project = 'eng-bot'
const env = process.env.ENV || 'dev'

export class EngBotStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)
        applyTags(this, 'stack')

        const usersTable = new dynamodb.Table(this, `EngBotUsersTable-${env}`, {
            partitionKey: {
                name: 'chatId',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'created',
                type: dynamodb.AttributeType.NUMBER,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        })
        applyTags(usersTable, 'users')
        const correctionsTable = new dynamodb.Table(this, `EngBotCorrectionsTable-${env}`, {
            partitionKey: {
                name: 'chatId',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'id',
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        })
        applyTags(correctionsTable, 'corrections')
        const correctionsIndex = correctionsTable.addLocalSecondaryIndex({
            indexName: 'correctionIndex',
            sortKey: {
                name: 'id',
                type: dynamodb.AttributeType.STRING,
            },
        })

        const assetsBucket = new s3.Bucket(this, `EngBotAssetsBucket-${env}`, {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
          })
        applyTags(assetsBucket, 'assets')

        new s3deploy.BucketDeployment(this, `DeployAssets-${env}`, {
            sources: [s3deploy.Source.asset(path.resolve('..', 'assets'))],
            destinationBucket: assetsBucket,
            destinationKeyPrefix: '',
        })
        const secretArns: Record<string, string> = {
            stag: 'arn:aws:secretsmanager:eu-central-1:296292975264:secret:eng-bot-tokens-stag-9XYFNW',
            prod: 'arn:aws:secretsmanager:eu-central-1:296292975264:secret:eng-bot-tokens-2BPbQd',
        }
        const bot = new Function(this, `EngBot-${env}`, {
            runtime: Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: Code.fromAsset(path.resolve('..', 'bot', 'dist', 'bot.zip')),
            timeout: cdk.Duration.seconds(60),
            environment: {
                ENV: env,
                SECRETS_ID: secretArns[env],
                LOG_LEVEL: 'debug',
                USERS_TABLE: usersTable.tableName,
                CORRECTIONS_TABLE: correctionsTable.tableName,
                ASSETS_BUCKET: assetsBucket.bucketName,
            },
        })
        applyTags(bot, 'bot')


        // add bot function permissions to secrets manager
        bot.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['secretsmanager:GetSecretValue'],
                resources: [ secretArns[env] ],
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
                resources: [usersTable.tableArn, correctionsTable.tableArn],
            })
        )

        bot.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
                resources: [assetsBucket.arnForObjects('*'), assetsBucket.bucketArn],
            })
        )

        const httpApi = new HttpApi(this, `EngBotApi-${env}`, {
            description: 'HTTP API',
        })
        applyTags(httpApi, 'api')

        httpApi.addRoutes({
            path: '/callback',
            methods: [HttpMethod.POST],
            integration: new HttpLambdaIntegration(`BotIntegration-${env}`, bot),
        })
    }
}

function applyTags(scope: Construct, name: string) {
    cdk.Tags.of(scope).add('project', project)
    cdk.Tags.of(scope).add('env', env)
    cdk.Tags.of(scope).add('Name', `${project}-${env}-${name}`)
}