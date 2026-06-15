<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { User, Post } from '@/types';
import DefaultComponent from './DefaultComponent.vue';
import { useAuth as useCustomAuth } from '@/composables/auth';
import * as Vue from 'vue';
</script>

<template>
  <div>Content</div>
</template>
