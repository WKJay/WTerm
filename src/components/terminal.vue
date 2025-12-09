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

const termMode = ref(true)

const traditionCfg = ref({
    timeStamps: false,
    hexRecv: false,
    hexSend: false,
    data: ''
})
const dataBitsList = [7, 8]
const stopBitsList = [1, 2]
const parityList = [{ label: '无校验', value: 'none' }, { label: '奇校验', value: 'odd' }, { label: '偶校验', value: 'even' }]
const xterm = ref(null)
const term = new Terminal({ rows: 35, cursorInactiveStyle: "outline", cursorStyle: "bar", cursorBlink: true, smoothScrollDuration: 100 })

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
    connect()
}
const serialCfgSetCancel = () => {
    serialCfg.value.open = false
}

const handleTermModeChange = () => {
    if (termMode.value) {
        //终端模式重置所有传统模式设置
        traditionCfg.value.timeStamps = false
        traditionCfg.value.hexRecv = false
        traditionCfg.value.hexSend = false
        traditionCfg.value.data = ''
    }
}

const requsetSerial = async () => {
    try {
        let _serialPort = await navigator.serial.requestPort()
        let info = serialPort.value?.getInfo()
        let newInfo = _serialPort.getInfo()
        if (newInfo == null || Object.keys(newInfo).length === 0) {
            message.error('未获取到串口信息,请选择正确的串口')
            return
        }
        if (info?.usbVendorId === newInfo.usbVendorId && info?.usbProductId === newInfo.usbProductId && connected.value) {
            message.info('该串口已连接,为避免异常断开，如需修改参数请断开后再修改')
            serialCfgSetCancel();
            return
        }
        serialPort.value = _serialPort
        serialPortInfoSet(SERIAL_PORT_SELECTED)
    } catch (e) {
        console.log(e)
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
    }

}

const handleTermClear = () => {
    term?.write('\x1b[2J\x1b[H')
}

const traditionSend = () => {
    if (traditionCfg.value.hexSend) {
        sendMsg(traditionCfg.value.data, { hex: true })
    } else {
        sendMsg(traditionCfg.value.data)
    }

}

const traditionClear = () => {
    traditionCfg.value.data = ''
}


const sendMsg = async (data, opt) => {
    if (!opt) opt = { hex: false }
    if (!connected.value) {
        message.error('串口未连接')
        return
    }
    const writer = serialPort.value.writable.getWriter()
    let msg
    if (opt.hex) {
        let hexData = data.split(' ')
        msg = new Uint8Array(hexData.map((v) => parseInt(v, 16)))
    } else {
        msg = new TextEncoder().encode(data)
    }
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
            let data = ''
            if (traditionCfg.value.timeStamps) {
                data = `[${new Date().toLocaleTimeString()}]:`
            }
            if (traditionCfg.value.hexRecv) {
                data += Array.from(value).map(v => v.toString(16).padStart(2, '0')).join(' ')
                data += ' '
            } else {
                data += new TextDecoder().decode(value)
            }

            if (traditionCfg.value.timeStamps) {
                data += "\r\n"
            }

            term.write(data)
        }
    } catch (e) {
        console.error(e)
        connected.value = false
        serialReader.releaseLock()
        serialPort.value.close()
        serialPort.value = null
        message.error('串口连接丢失,请重新选择串口')
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
        if (termMode.value) {
            sendMsg(data)
        } else {
            message.info("当前处于传统模式,请使用下方输入框发送数据")
        }
    })

    window.onresize = () => {
        if (term && fitAddon)
            fitAddon.fit()
    }

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
                        <a-button type="primary" @click="serialCfgSet">确认并连接</a-button>
                    </template>
                    <a-form>
                        <a-form-item label="波特率">
                            <div>
                                <a-input-number id="baudrate" v-model:value="serialCfg.baudRate" :min="1"
                                    style="width: 120px" />
                            </div>
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
                <a-button @click="handleTermClear" type="dashed">清屏</a-button>
            </div>

            <div class="toolBarItem">
                <a-tooltip title="切换终端模式或传统串口调试模式">
                    <a-switch v-model:checked="termMode" checked-children="终端" un-checked-children="传统"
                        @change="handleTermModeChange" />
                </a-tooltip>
            </div>
        </div>
        <div class="term">
            <div class="xtermHead">
                {{ serialPortInfo }}
            </div>
            <div class="termWrapper">
                <div ref="xterm"></div>
            </div>
        </div>
        <!-- 串口调试输入区 -->
        <a-card>
            <div v-if="!termMode">
                <div class="tradModeTools">
                    <a-checkbox v-model:checked="traditionCfg.hexRecv">hex 显示</a-checkbox>
                    <a-checkbox v-model:checked="traditionCfg.hexSend">hex 发送</a-checkbox>
                    <a-checkbox v-model:checked="traditionCfg.timeStamps">时间戳</a-checkbox>
                </div>
                <div class="tradModeInput">
                    <a-textarea class="text-area" v-model:value="traditionCfg.data" />
                    <a-button style=" height:auto" type="primary" @click="traditionSend"
                        :disabled="traditionCfg.data.length == 0">发送</a-button>
                    <a-button style=" height:auto" @click="traditionClear">清空</a-button>
                </div>

            </div>
        </a-card>
    </div>
</template>

<style scoped>
:deep(.ant-card-body) {
    padding: 12px;
}

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

/* .termWrapper {
    padding-left: 10px;
    background-color: black;
} */

.tradModeTools {
    margin-bottom: 10px;
}

.tradModeInput {
    display: inline-flex;
    width: 100%;
    gap: 8px
}

.tradModeInput>.text-area {
    flex: 1;
}

h1 {
    margin: 5px;
}

:deep(.xterm) {
    padding: 10px
}
</style>