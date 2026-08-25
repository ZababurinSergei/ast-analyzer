import './assets/main.css'
import {
    // необходимые компоненты
    NDataTable,
    NConfigProvider
} from 'naive-ui'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App);
// Регистрируем глобально компоненты Naive UI
app.component('NDataTable', NDataTable);
app.component('NConfigProvider', NConfigProvider);
app.mount('#app');
