<script setup lang="ts">
import { useAuth } from '@/composables/useAuth';
import { useFetch } from '@/composables/useFetch';
import { useLocalStorage } from '@vueuse/core';

const { user, login } = useAuth();
const { data, loading } = useFetch('/api/users');
const theme = useLocalStorage('theme', 'dark');
</script>

<template>
  <div>{{ user?.name }}</div>
</template>
