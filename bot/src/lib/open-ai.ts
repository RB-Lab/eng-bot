import { Configuration, OpenAIApi } from 'openai'
import { log } from './log'
import { Correction, CorrectionUnit } from './model'

export interface OpenAI {
    getCorrection(essay: string): Promise<string>
    getExplanation(correction: Correction, unit: CorrectionUnit): Promise<string>
}

export class MockOpenAI implements OpenAI {
    getExplanation(correction: Correction, unit: CorrectionUnit): Promise<string> {
        if(unit.add && unit.delete) return Promise.resolve(`I replaced "${unit.delete}" with "${unit.add}" because I just felt like it`)
        if(unit.add) return Promise.resolve(`I added "${unit.add}" because I just felt like it`)
        if(unit.delete) return Promise.resolve(`I deleted "${unit.delete}" because I just felt like it`)
        return Promise.resolve('I just felt like it')
    }
    async getCorrection(essay: string) {
        return new Promise<string>((resolve) => {
            setTimeout(() => {
                const essayArr = essay.split(' ')
                if(essayArr.length < 10) resolve(essay)
                const randomWordsCount = Math.ceil(Math.random() * 7)
                for (let i = 0; i < randomWordsCount; i++) {
                    const randomIndex = Math.floor(Math.random() * essayArr.length)
                    const randomWord = essayArr[randomIndex + 5 + i]
                    if(Math.random() >= 0.6) {
                        essayArr.splice(randomIndex, 1) 
                        continue
                    } else if(Math.random() >= 0.6) {
                        essayArr.splice(randomIndex, 0, randomWord)
                        continue
                    }
                    essayArr[randomIndex] = randomWord
                }
                resolve(essayArr.join(' '))
            }, 400)
        })
    }
}

export class RealOpenAI implements OpenAI {
    private api: OpenAIApi
    constructor(private readonly token: string) {
        this.api = new OpenAIApi(new Configuration({ apiKey: token }))
    }
    getExplanation(correction: Correction, unit: CorrectionUnit): Promise<string> {
        throw new Error('Method not implemented.')
    }

    async getCorrection(essay: string) {
        const completion = await this.api.createCompletion({
            model: 'text-davinci-003',
            prompt: generateCorrectionPrompt(essay),
            temperature: 0,
            max_tokens: essay.length + 100,
            n: 1,
        })
    
        log.info('used:', completion.data.usage)
        return completion.data['choices'][0]['text'] || ''
    }
}

function generateCorrectionPrompt(essay: string) {
    return `Act as my English tutor. I will write an essay and you will correct all the grammar mistakes. Do not change the style of wording, and do not rephrase sentences if there are no mistakes. If the essay does not contain any grammar errors, do not change it.

[essay]: I had this question stuck in mind long ago: on Miranda, a Uranus' moon, there's Verona Rupes, 20km high cliff. If you jump from the top of the cliff onto a trampoline would you reach escape velocity? 
[correction]: I have had this question stuck in my mind for a long time: On Miranda, a Uranus' moon, there's Verona Rupes, a 20 km high cliff. If you were to jump off the top of the cliff onto a trampoline, would you reach escape velocity?

[essay]: Google finally fired the guy who created the drama around the LaMDA chat bot.
[correction]: Google has finally fired the guy who created the drama around the LaMDA chatbot.

[essay]: I would enjoy my weekend if the washing machine hadn't broken down the other day.
[correction]: I would enjoy my weekend if the washing machine hadn't broken down the other day.

[essay]: ${essay}
[correction]:`
}