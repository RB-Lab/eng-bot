import { ArrayChange, diffArrays } from 'diff'

export function formatCorrection(oldText: string, newText: string) {
    const splitOldText = oldText.split(/\n/)
    const splitNewText = newText.split(/\n/)
    if (splitOldText.length !== splitNewText.length) {
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

export function createCorrectionUnits(oldText: string, newText: string) {
    const splitOldText = oldText.split(/\n/)
    const splitNewText = newText.split(/\n/)
    if (splitOldText.length !== splitNewText.length) {
        // TODO Hmm.. there should be a better way with diffing against paragraphs 🤔
        return makeCorrectionUnits(oldText, newText)
    }
    return splitOldText.map((line, index) =>
        makeCorrectionUnits(line, splitNewText[index])
    ).flat()
}

function makeCorrectionUnits(oldText: string, newText: string) {
    const changes = diffArrays(oldText.split(/\s/), newText.split(/\s/))
    const correctionUnits = []
    let currentUnit = {add: '', delete: ''}
    for(const change of changes) {
        if(!change.added && !change.removed) {
            if(currentUnit.add || currentUnit.delete) {
                correctionUnits.push(currentUnit)
                currentUnit = {add: '', delete: ''}
            } 
        }
        if(change.added) {
            currentUnit.add += change.value.join(' ') + ' '
        }
        if(change.removed) {
            currentUnit.delete += change.value.join(' ') + ' '
        }
    }
    return correctionUnits
}

export function formatCorrectionUnit(unit: {add: string, delete: string}) {
    if(unit.add && unit.delete) return `${unit.delete} → ${unit.add}`
    if(unit.add) return `+ ${unit.add}`
    if(unit.delete) return `- ${unit.delete}`
    return null
}