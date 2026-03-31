export function useAlignApi() {
    const align = async (payload: AlignRequestPayload): Promise<AlignResponsePayload> => {
        return await $fetch<AlignResponsePayload>('/api/align', {
            method: 'POST',
            body: payload,
        })
    }

    return {
        align,
    }
}
