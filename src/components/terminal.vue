<script setup>
import { ref, onMounted } from 'vue'
import { Terminal } from '@xterm/xterm'
import { CanvasAddon } from '@xterm/addon-canvas'
import { FitAddon } from '@xterm/addon-fit'
import { message } from 'ant-design-vue';


import '@xterm/xterm/css/xterm.css'

const connected = ref(false)
const serialPortInfo = ref('未选择设备')
const serialCfg = ref({
    open: false,
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none',
})
const baudRateList = [2400, 4800, 9600, 19200, 38400, 57600, 115200]
const dataBitsList = [7, 8]
const stopBitsList = [1, 2]
const parityList = [{ label: '无校验', value: 'none' }, { label: '奇校验', value: 'odd' }, { label: '偶校验', value: 'even' }]
const xterm = ref(null)
const term = new Terminal({ rows: 40, cursorInactiveStyle: "outline", cursorStyle: "bar", cursorBlink: true, smoothScrollDuration: 100 })

let serialPort = ref(null)
let serialReader = {}

const SERIAL_PORT_NOT_SELECTED = 0
const SERIAL_PORT_SELECTED = 1
const SERIAL_PORT_CONNECTED = 2

const serialPortInfoSet = (value) => {
    if (value === SERIAL_PORT_NOT_SELECTED) {
        serialPortInfo.value = '未选择设备'
    } else if (value === SERIAL_PORT_SELECTED) {
        serialPortInfo.value = '设备已选择 待连接'
    } else if (value === SERIAL_PORT_CONNECTED) {
        serialPortInfo.value = '设备已连接'
    } else {
        serialPortInfo.value = '状态异常'
    }
}
const serialCfgOpen = () => {
    serialCfg.value.open = true
}
const serialCfgSet = () => {
    serialCfg.value.open = false
}
const serialCfgSetCancel = () => {
    serialCfg.value.open = false
}

const requsetSerial = async () => {
    try {
        serialPort.value = await navigator.serial.requestPort()
        serialPortInfoSet(SERIAL_PORT_SELECTED)
    } catch (e) {
        serialPortInfoSet(SERIAL_PORT_NOT_SELECTED)
        serialPort.value = null
    }
}
const connect = async () => {
    try {
        if (serialPort.value == null) {
            message.error('请先选择串口')
            serialCfgOpen()
            return
        }
        await serialPort.value.open({
            baudRate: serialCfg.value.baudRate,
            dataBits: serialCfg.value.dataBits,
            stopBits: serialCfg.value.stopBits,
            parity: serialCfg.value.parity,
            flowControl: serialCfg.value.flowControl,
        })
        connected.value = true
        serialPortInfoSet(SERIAL_PORT_CONNECTED)
        setTimeout(() => {
            readMsg()
        }, 10);
    } catch (e) {
        console.error(e)
    }
}
const disconnect = async () => {
    if (serialPort.value) {
        serialReader.cancel()
        console.log(term.buffer)
    }

}

const sendMsg = async (data) => {
    if (!connected.value) return
    const writer = serialPort.value.writable.getWriter()
    let msg = new TextEncoder().encode(data)
    await writer.write(msg)
    writer.releaseLock()
}

const readMsg = async () => {
    serialReader = serialPort.value.readable.getReader()
    try {
        while (true) {
            const { value, done } = await serialReader.read()
            if (done) {
                connected.value = false
                serialReader.releaseLock()
                serialPort.value.close()
                serialPortInfoSet(SERIAL_PORT_SELECTED)
                break
            }
            term.write(new TextDecoder().decode(value))
        }
    } catch (e) {
        console.error(e)
        serialReader.releaseLock()
        serialPortInfoSet(SERIAL_PORT_SELECTED)
    }
}

onMounted(() => {
    const cancasAddon = new CanvasAddon()
    const fitAddon = new FitAddon()
    term.loadAddon(cancasAddon)
    term.loadAddon(fitAddon)

    term.open(xterm.value)
    fitAddon.fit()
    term.onData(data => {
        sendMsg(data)
    })

    if (!('serial' in navigator)) {
        alert('当前浏览器不支持串口操作,请更换Edge或Chrome浏览器')
    }
})

</script>

<template>
    <div id="app">
        <div class="head">
            <h1>W · TERMINAL</h1>
        </div>

        <div class="toolBar">
            <div class="toolBarItem">
                <a-button @click="serialCfgOpen">串口配置</a-button>
                <a-modal v-model:open="serialCfg.open" title="串口配置" width="250px">
                    <template #footer>
                        <a-button @click="serialCfgSetCancel">取消</a-button>
                        <a-button type="primary" @click="serialCfgSet">确认</a-button>
                    </template>
                    <a-form>
                        <a-form-item label="波特率">
                            <a-select style="width: 120px" v-model:value="serialCfg.baudRate">
                                <a-select-option v-for="br in baudRateList" :value="br">{{ br }}</a-select-option>
                            </a-select>
                        </a-form-item>

                        <a-form-item label="校验位">
                            <a-select style="width: 120px" v-model:value="serialCfg.parity">
                                <a-select-option v-for="p in parityList" :value="p.value">{{ p.label
                                    }}</a-select-option>
                            </a-select>
                        </a-form-item>

                        <a-form-item label="数据位">
                            <a-select style="width: 120px" v-model:value="serialCfg.dataBits">
                                <a-select-option v-for="db in dataBitsList" :value="db">{{ db }}</a-select-option>
                            </a-select>
                        </a-form-item>

                        <a-form-item label="停止位">
                            <a-select style="width: 120px" v-model:value="serialCfg.stopBits">
                                <a-select-option v-for="sb in stopBitsList" :value="sb">{{ sb }}</a-select-option>
                            </a-select>
                        </a-form-item>

                        <a-form-item>
                            <a-button type="primary" @click="requsetSerial" block>选择串口</a-button>
                            <div style="margin-top: 10px;">
                                <a-alert v-if="serialPort == null" message="串口未选择" type="warning" />
                                <a-alert v-else message="串口已选择" type="success"> </a-alert>
                            </div>
                        </a-form-item>

                    </a-form>
                </a-modal>
            </div>

            <div class="toolBarItem">
                <a-button @click="connect" :disabled="connected">连接</a-button>
            </div>

            <div class="toolBarItem">
                <a-button @click="disconnect" :disabled="!connected">断开连接</a-button>
            </div>

            <div class="toolBarItem">
                <a-button @click="() => { term?.clear() }" type="dashed">清屏</a-button>
            </div>

        </div>
        <div class="term">
            <div class="xtermHead">
                {{ serialPortInfo }}
            </div>
            <div class="termWrapper">
                <div ref="xterm">

                </div>
            </div>

        </div>
    </div>
</template>

<style scoped>
body {
    font-family: Arial, sans-serif
}

#app {
    margin: 20px;
}

.head {
    text-align: center;
    margin-bottom: 10px;
}

.toolBar {
    margin-bottom: 10px;
    text-align: center;
}

.toolBarItem {
    display: inline-block;
    margin-right: 15px;
    margin-bottom: 8px
}

.xtermHead {
    width: 100%;
    text-align: center;
    background-color: rgb(51, 51, 51);
    padding: 2px;
    color: white;
}

.term {
    border: 1px solid #ccc;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 10px;
}

.termWrapper {
    background-color: black;
}

h1 {
    margin: 5px;
}
</style>