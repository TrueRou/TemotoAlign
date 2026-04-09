<script setup lang="ts">
const { toasts, dismiss } = useToast()

function toastClass(type: string) {
    if (type === 'error')
        return 'bg-[#ff3b30] text-white'
    return 'bg-[#1d1d1f] text-white'
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
                    class="cursor-pointer rounded-lg px-4 py-3 shadow-[3px_5px_30px_rgba(0,0,0,0.22)]"
                    :class="toastClass(toast.type)"
                    @click="dismiss(toast.id)"
                >
                    <span class="apple-caption">{{ toast.message }}</span>
                </div>
            </TransitionGroup>
        </div>
    </Teleport>
</template>
