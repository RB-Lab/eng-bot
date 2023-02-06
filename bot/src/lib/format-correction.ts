import { ArrayChange, diffArrays } from 'diff'

export function formatCorrection(oldText: string, newText: string) {
    const splitOldText = oldText.split(/\n/)
    const splitNewText = newText.split(/\n/)
    if(splitOldText.length !== splitNewText.length) {
        // TODO Hmm.. there should be a better way with diffing against paragraphs 🤔
        return formatLines(oldText, newText)
    }
    return splitOldText
        .map((line, index) => formatLines(line, splitNewText[index]))
        .join('\n')
}

function formatLines(line1: string, line2: string) {
    const changes = diffArrays(line1.split(/\s/), line2.split(/\s/))
    return changes.map(formatChange).join(' ')
}

function formatChange(change: ArrayChange<string>) {
    if (change.added) return `<b>${change.value.join(' ')}</b>`
    else if (change.removed) return `<s>${change.value.join(' ')}</s>`
    else return change.value.join(' ')
}
