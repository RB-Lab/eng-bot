import { Configuration, OpenAIApi } from 'openai'
import { getSecrets } from '../secret-service'


export async function correctEssay(essay: string) {
    const configuration = new Configuration({
        apiKey: (await getSecrets()).openApiToken,
    })
    const openai = new OpenAIApi(configuration)

    const completion = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: generatePrompt(essay),
        temperature: 0,
        max_tokens: essay.length + 100,
        n: 1,
    })

    console.log('[INFO] used:', completion.data.usage)
    return completion.data['choices'][0]['text'] || ''
}

function generatePrompt(essay: string) {
    return `Act as my English tutor. I will write an essay and you will correct all the grammar mistakes. Do not change style of wording, do not rephrase sentences if there are no mistakes.

[essay]: I had this question stuck in mind long ago: on Miranda, a Uranus' moon, there's Verona Rupes, 20km high cliff. If you jump from the top of the cliff onto a trampoline would you reach escape velocity? 
[correction]: I have had this question stuck in my mind for a long time: On Miranda, a Uranus' moon, there's Verona Rupes, a 20 km high cliff. If you were to jump off the top of the cliff onto a trampoline, would you reach escape velocity?

[essay]: Google finally fired the guy who created the drama around the LaMDA chat bot.
[correction]: Google has finally fired the guy who created the drama around the LaMDA chatbot.

[essay]: ${essay}
[correction]:`
}