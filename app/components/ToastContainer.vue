<script setup lang="ts">
const { toasts, dismiss } = useToast()

function alertClass(type: string) {
    if (type === 'success')
        return 'alert-success'
    if (type === 'error')
        return 'alert-error'
    return 'alert-info'
}
</script>

<template>
    <Teleport to="body">
        <div class="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
            <TransitionGroup
                enter-active-class="transition-all duration-300 ease-out"
                leave-active-class="transition-all duration-200 ease-in"
                enter-from-class="translate-x-8 opacity-0"
                leave-to-class="translate-x-8 opacity-0"
            >
                <div
                    v-for="toast in toasts"
                    :key="toast.id"
                    class="alert shadow-lg"
                    :class="alertClass(toast.type)"
                    @click="dismiss(toast.id)"
                >
                    <span class="text-sm">{{ toast.message }}</span>
                </div>
            </TransitionGroup>
        </div>
    </Teleport>
</template>
