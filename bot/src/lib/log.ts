export const log = {
    debug: (...args: any[]) => {
        if (getLogLevel() <= 0) {
            console.log(...args)
        }
    },
    info: (...args: any[]) => {
        if (getLogLevel() <= 1) {
            console.info(...args)
        }
    },
    warn: (...args: any[]) => {
        if (getLogLevel() <= 2) {
            console.warn(...args)
        }
    },
    error: (...args: any[]) => {
        console.error(...args)
    },
}

function getLogLevel() {
    if (process.env.LOG_LEVEL === 'debug') {
        return 0
    }
    if (process.env.LOG_LEVEL === 'info') {
        return 1
    }
    if (process.env.LOG_LEVEL === 'warn') {
        return 2
    }
    return 1
}
