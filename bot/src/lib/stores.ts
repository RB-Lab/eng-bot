import { log } from './log'
import * as fs from 'fs'
import * as yaml from 'js-yaml'

import * as aws from 'aws-sdk'

export interface Stores {
    topicsStore: TopicStore
    userStore: UserStore
    correctionStore: CorrectionStore
}

export interface UserStore {
    getUser(chatId: ID): Promise<User | null>
    createUser(user: User): Promise<User>
}

export interface CorrectionStore {
    createCorrection(correction: Omit<Correction, 'id'>): Promise<Correction>
    getCorrection(chatId: ID, id: ID): Promise<Correction | null>
    updateCorrection(correction: Correction): Promise<Correction | null>
}

export interface TopicStore {
    getCategories(): Promise<Category[]>
    getTopics(categoryId: ID): Promise<string[]>
}
export interface Category {
    id: ID
    name: string
}

export interface Correction {
    id: ID
    chatId: ID
    text: string
    created: number
    corrected: string
    correctionUnits: CorrectionUnit[]
}

export interface CorrectionUnit {
    add: string
    delete: string
    explanation?: string
}

export type ID = string | number
export interface User {
    chatId: ID
    created: number
}

export class TestStores implements Stores {
    topicsStore = new TestTopicStore()
    userStore = new TestUserStore()
    correctionStore = new TestCorrectionStore()
}

export class TestUserStore implements UserStore {
    users: User[] = []
    async getUser(chatId: ID): Promise<User | null> {
        log.debug('getting user by chatId', chatId)
        return this.users.find((u) => u.chatId === chatId) || null
    }
    async createUser(user: User): Promise<User> {
        log.debug('creating user', user)
        const newUser = {
            ...user,
            id: this.users.length.toString(),
        }
        this.users.push(newUser)
        return newUser
    }
}

export class TestCorrectionStore implements CorrectionStore {
    corrections: Correction[] = []
    async createCorrection(
        correction: Omit<Correction, 'id'>
    ): Promise<Correction> {
        log.debug('creating correction', correction)
        const newCorrection = {
            ...correction,
            id: this.corrections.length.toString(),
        }
        this.corrections.push(newCorrection)
        return newCorrection
    }
    async getCorrection(chatId: ID, id: ID): Promise<Correction | null> {
        log.debug('getting correction by id', id)
        return this.corrections.find((c) => c.id === id) || null
    }
    updateCorrection(correction: Correction): Promise<Correction | null> {
        log.debug('updating correction', correction)
        const index = this.corrections.findIndex((c) => c.id === correction.id)
        if (index === -1) {
            log.error('correction not found', correction)
            return Promise.resolve(null)
        }
        this.corrections[index] = correction
        return Promise.resolve(correction)
    }
}

type TopicsFile = Record<string, string[]>

export class TestTopicStore implements TopicStore {
    private topics: TopicsFile | null = null
    async getCategories(): Promise<Category[]> {
        if (!this.topics) {
            this.topics = await this.loadTopics()
        }
        return Object.keys(this.topics).map((name, id) => ({ id, name }))
    }

    async getTopics(categoryId: ID): Promise<string[]> {
        if (!this.topics) {
            this.topics = await this.loadTopics()
        }
        const categories = Object.keys(this.topics)
        const category = categories[Number(categoryId)]
        if (!category)
            throw new Error(
                `category not found, id: ${categoryId}, total categories: ${categories.length}`
            )
        return this.topics[category]
    }

    private loadTopics(): Promise<TopicsFile> {
        return new Promise((resolve, reject) => {
            fs.readFile('./assets/topics.yml', 'utf8', (err, data) => {
                if (err) {
                    reject(err)
                }
                resolve(yaml.load(data) as TopicsFile)
            })
        })
    }
}

export class AwsStores implements Stores {
    userStore: DynamoUserStore
    correctionStore: DynamoCorrectionStore
    topicsStore: TopicStore
    constructor() {
        const client = new aws.DynamoDB.DocumentClient()
        this.userStore = new DynamoUserStore(client)
        this.correctionStore = new DynamoCorrectionStore(client)
        this.topicsStore = new S3TopicStore(new aws.S3())
    }
}

export class DynamoUserStore implements UserStore {
    private tableName = process.env.USERS_TABLE || 'EngBotUsers'
    constructor(private client: aws.DynamoDB.DocumentClient) {}
    async getUser(chatId: ID): Promise<User | null> {
        log.debug('getting user by chatId', chatId)
        const result = await this.client
            .query({
                TableName: this.tableName,
                KeyConditionExpression: 'chatId = :chatId',
                ExpressionAttributeValues: {
                    ':chatId': String(chatId),
                },
            })
            .promise()
        return (result.$response.data?.Items?.[0] as User) || null
    }
    async createUser(user: User): Promise<User> {
        log.debug('creating user', user)

        await this.client
            .put({
                TableName: this.tableName,
                Item: {
                    chatId: String(user.chatId),
                    created: user.created,
                },
            })
            .promise()
        return user
    }
}

export class DynamoCorrectionStore implements CorrectionStore {
    private tableName = process.env.CORRECTIONS_TABLE || 'EngBotCorrections'

    constructor(private client: aws.DynamoDB.DocumentClient) {}

    async createCorrection(
        correction: Omit<Correction, 'id'>
    ): Promise<Correction> {
        log.debug('creating correction', correction)
        const rand = Math.random().toString(36).substring(2, 15)
        const id = `${correction.chatId}-${Date.now()}-${rand}`
        const item = { id, ...correction, chatId: String(correction.chatId) }
        await this.client
            .put({
                TableName: this.tableName,
                Item: item,
            })
            .promise()
        return item
    }

    async getCorrection(chatId: ID, id: ID): Promise<Correction | null> {
        log.debug('getting correction by id', chatId, id)
        const result = await this.client
            .query({
                TableName: this.tableName,
                KeyConditionExpression: 'chatId = :chatId and id = :id',
                ExpressionAttributeValues: {
                    ':chatId': String(chatId),
                    ':id': id,
                },
            })
            .promise()
        return (result.$response.data?.Items?.[0] as Correction) || null
    }

    async updateCorrection(correction: Correction): Promise<Correction | null> {
        log.debug('updating correction', correction)
        const result = await this.client
            .update({
                TableName: this.tableName,
                Key: {
                    chatId: String(correction.chatId),
                    id: correction.id,
                },
                UpdateExpression:
                    'set corrected = :corrected, correctionUnits = :correctionUnits',
                ExpressionAttributeValues: {
                    ':corrected': correction.corrected,
                    ':correctionUnits': correction.correctionUnits,
                },
                ReturnValues: 'ALL_NEW',
            })
            .promise()
        return (result.$response.data?.Attributes as Correction) || null
    }
}

export class S3TopicStore implements TopicStore {
    private topics: TopicsFile | null = null
    private bucketName = process.env.ASSETS_BUCKET || 'eng-bot-assets'
    constructor(private s3: aws.S3) {}
    async getCategories(): Promise<Category[]> {
        if (!this.topics) {
            this.topics = await this.loadTopics()
        }
        return Object.keys(this.topics).map((name, id) => ({ id, name }))
    }

    async getTopics(categoryId: ID): Promise<string[]> {
        if (!this.topics) {
            this.topics = await this.loadTopics()
        }
        const categories = Object.keys(this.topics)
        const category = categories[Number(categoryId)]
        if (!category)
            throw new Error(
                `category not found, id: ${categoryId}, total categories: ${categories.length}`
            )
        return this.topics[category]
    }

    private loadTopics(): Promise<TopicsFile> {
        return new Promise((resolve, reject) => {
            this.s3.getObject(
                {
                    Bucket: this.bucketName,
                    Key: 'topics.yml',
                },
                (err, data) => {
                    if (err) {
                        return reject(err)
                    }
                    
                    try {
                        const content = data.Body?.toString('utf-8') || ''
                        resolve(yaml.load(content) as TopicsFile)
                    } catch (error) {
                        reject(error)
                    }
                }
            )
        })
    }
}