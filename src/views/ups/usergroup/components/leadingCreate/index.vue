<script setup lang="ts">
/**
 * 导入创建（上传文件）（对应 v2 views/ups/usergroup/components/leadingCreate/index.vue）。
 * 目前只有「自定义规则」这条创建方式是开放的，本组件在 group-creator 里靠 v-show 隐藏着。
 */
import { onMounted, ref, watch } from 'vue'
import type { UploadFile, UploadInstance, UploadUserFile } from 'element-plus'
import type { PropertyListMap, PropertyNode } from '../../types'

const props = withDefaults(
  defineProps<{
    propertyList?: Partial<PropertyListMap>
  }>(),
  {
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
    }),
  },
)

const upload = ref<UploadInstance | null>(null)

const userProperty = ref('')
const userPropertyList = ref<PropertyNode[]>([])
const fileList = ref<UploadUserFile[]>([])

watch(
  () => props.propertyList.userProperties,
  (newVal) => {
    userPropertyList.value = newVal || []
    // 与 v2 一致（v2 此处逻辑存疑：直接取 [0].name，列表为空时会抛 TypeError）
    userProperty.value = userPropertyList.value[0]?.name ?? ''
  },
  { deep: true },
)

onMounted(() => {
  if (userPropertyList.value && userPropertyList.value.length > 0) {
    userProperty.value = userPropertyList.value[0]?.name ?? ''
  }
})

function submitUpload() {
  upload.value?.submit()
}

function handleRemove(file: UploadFile, files: UploadFile[]) {
  console.log(file, files)
}

function handlePreview(file: UploadFile) {
  console.log(file)
}

defineExpose({ submitUpload })
</script>

<template>
  <div class="leadIn">
    <div class="title">
      上传文件
      <p>(选填)</p>
    </div>
    <div class="leadContent">
      <p>用户属性</p>
      <div style="display: flex; align-items: center; margin-top: 5px">
        <el-select v-model="userProperty" style="width: 230px">
          <el-option
            v-for="x in propertyList.userProperties"
            :key="x.name"
            :label="x.displayName"
            :value="x.name"
          />
        </el-select>
        <div
          style="
            height: 30px;
            line-height: 30px;
            margin-left: 10px;
            padding: 0 15px;
            border-radius: 4px;
            font-size: 13px;
            background-color: rgb(200 203 205);
          "
        >
          字符串类型
        </div>
      </div>
      <p style="margin-top: 20px">上传</p>
      <el-upload
        ref="upload"
        class="upload-demo"
        action="https://jsonplaceholder.typicode.com/posts/"
        :on-preview="handlePreview"
        :on-remove="handleRemove"
        :file-list="fileList"
        :auto-upload="false"
      >
        <template #trigger>
          <el-button class="zc_btn_default">选取文件</el-button>
        </template>
        <template #tip>
          <div class="el-upload__tip" style="margin-top: 5px">
            上传 TXT、CSV 格式的文件与用户属性进行匹配，匹配结果保留为分群用户
          </div>
        </template>
        <!-- v2 里这一段是 el-upload 的默认插槽（跟在 trigger 之后），element-plus 同样是这个顺序 -->
        <div style="margin-top: 10px; font-size: 12px; color: #2c7be5">
          下载 TXT 模板 下载 CSV 模板
        </div>
      </el-upload>
    </div>
    <div style="font-size: 13px; color: rgb(209 213 215)">
      可暂不上传文件，在分群创建成功后再补充上传
    </div>
  </div>
</template>

<style lang="scss" scoped>
.leadIn {
  .title {
    margin-top: 20px;
    display: flex;
    font-size: 13px;

    p:nth-child(1) {
      color: #a19f9f;
      margin-left: 5px;
    }
  }

  .leadContent {
    width: 100%;
    min-height: 200px;
    background: #efefef;
    border-radius: 6px;
    margin: 15px 0;
    padding: 20px;

    p {
      line-height: 25px;
      font-size: 13px;
    }

    .upload-demo {
      margin-top: 10px;
    }
  }
}
</style>
