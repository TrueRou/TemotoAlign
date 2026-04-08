const toasts = ref<{ id: string, message: string, type: 'success' | 'error' | 'info' }[]>([])

function show(message: string, type: 'success' | 'error' | 'info' = 'info', durationMs = 3000) {
    const id = crypto.randomUUID()
    toasts.value.push({ id, message, type })
    setTimeout(() => dismiss(id), durationMs)
}

function dismiss(id: string) {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1)
        toasts.value.splice(idx, 1)
}

export function useToast() {
    return { toasts: readonly(toasts), show, dismiss }
}
