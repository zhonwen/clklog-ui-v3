<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getSetting, saveSetting } from '@/api/sysmanage/globalsetting'
import type { GlobalSetting } from '@/api/sysmanage/globalsetting'
import { useLatestOnly } from '@/composables/useLatestOnly'
import DialogPage from './component/dialog.vue'

const { next, isLatest } = useLatestOnly()

const dialogPageRef = ref<{ dialogEvent: () => void } | null>(null)

const form = ref<GlobalSetting>({
  excludedIp: '',
  excludedUa: '',
  excludedUrlParams: '',
  searchwordKey: '',
  searchwordCategoryKey: '',
})

function handleMethodsBlur() {
  // 与 v2 一致（v2 此处逻辑存疑：只是一条调试用的 console.log，没有任何业务作用）
  console.log(form.value.excludedIp, '失去焦点内容')
}

function openDialogEvent() {
  dialogPageRef.value?.dialogEvent()
}

function loadSetting() {
  const token = next()
  getSetting()
    .then((response) => {
      if (!isLatest(token)) return
      form.value = response?.data || {}
    })
    .catch(() => {
      if (!isLatest(token)) return
      /* 报错已由请求层统一提示 */
    })
}

function submitSaveForm() {
  if (window.globalConfig.is_clklog_demo_environment) {
    return openDialogEvent()
  }
  void saveSetting({ ...form.value }).then(() => {
    ElMessage({ message: '保存成功', type: 'success', duration: 2000 })
  })
}

onMounted(() => {
  loadSetting()
})
</script>

<template>
  <div class="public-block">
    <div class="Overview public-hoverItem" style="padding: 25px">
      <div class="public-firstHead">全局设置</div>
      <el-form :model="form" size="small" :inline="true">
        <el-row>
          <el-col :span="11">
            <div class="gm-left-header" style="margin-top: 30px">
              <p class="gm-h1">排除的全局的IP地址</p>
              <p class="gm-h2">以下IP地址将被排除在所有项目统计数据外。</p>

              <el-form-item prop="excludedIp" class="gp-item-01">
                <el-input
                  v-model="form.excludedIp"
                  type="textarea"
                  :rows="3"
                  class="gm-input-01"
                  placeholder=""
                  @blur="handleMethodsBlur()"
                />
              </el-form-item>
            </div>
          </el-col>
          <el-col :span="13">
            <div class="gm-right">
              <div class="gm-right-prompt">
                输入您要排除在系统统计之外的IP列表(每行一个)。您可以使用CIDR表示法,例如1.2.3.4/24,也可以使用通配符,例如1.2.3.*或1.2.*.*。
                <br /><br />
                <!-- 您的IP位址是 -->
              </div>
            </div>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="11">
            <div class="gm-left-header">
              <p class="gm-h1">排除的全局的用户代理列表</p>
              <p class="gm-h2">以下用户代理将被排除在所有项目统计外。</p>

              <el-form-item prop="excludedUa" class="gp-item-01">
                <el-input
                  v-model="form.excludedUa"
                  type="textarea"
                  :rows="3"
                  class="gm-input-01"
                  placeholder=""
                />
              </el-form-item>
            </div>
          </el-col>
          <el-col :span="13">
            <div class="gm-right">
              <div class="gm-right-prompt">
                输入不需要加入系统统计的用户代理列表 (每行一个)，支持正则表达式。
                如果访客的用户代理字串包含指定的字符，访问将不被 统计。 <br /><br />您可以用它排除统计机器人。例如/bot
                spiderlcrawlscanner/i。
              </div>
            </div>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="11">
            <div class="gm-left-header">
              <p class="gm-h1">排除的全局的URL参数列表</p>
              <p class="gm-h2">以下URL参数将从所有项目的受访页面分析统计中排除。</p>

              <el-form-item prop="excludedUrlParams" class="gp-item-01">
                <el-input
                  v-model="form.excludedUrlParams"
                  type="textarea"
                  :rows="3"
                  class="gm-input-01"
                  placeholder=""
                />
              </el-form-item>
            </div>
          </el-col>
          <el-col :span="13">
            <div class="gm-right">
              <div class="gm-right-prompt">
                输入要排除的URL查询参数列表
                (每行一个)，以便从受访页面分析报告中排除因无效参数产生的页面。支持普通参数、正则表达式。
              </div>
            </div>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="11">
            <div class="gm-left-header">
              <p class="gm-h1">全局的站内搜索关键词参数</p>
              <p class="gm-h2">以下参数将作为所有项目的站内搜索关键词参数。</p>

              <el-form-item prop="searchwordKey" class="gp-item-01">
                <el-input
                  v-model="form.searchwordKey"
                  type="textarea"
                  :rows="3"
                  class="gm-input-01"
                  placeholder=""
                />
              </el-form-item>
            </div>
          </el-col>
          <el-col :span="13">
            <div class="gm-right">
              <div class="gm-right-prompt">输入用逗号分开的包含站内搜索关键字的所有搜索参数名称的列表。</div>
            </div>
          </el-col>
        </el-row>
        <!-- v2 此处注释掉了「全局的站内搜索关键词分类参数」一栏，保持一致不迁移 -->
      </el-form>
      <!-- v2 这个 div 上写了 slot="footer"，但它的父级是普通 div 而不是组件，插槽本身不生效 -->
      <div class="dialog-footer">
        <el-row>
          <el-col :span="20">&nbsp;&nbsp;</el-col>
          <el-col :span="4">
            <el-button type="primary" style="margin: 50px 0 100px 20px" @click="submitSaveForm">
              保存
            </el-button>
          </el-col>
        </el-row>
      </div>
    </div>
    <DialogPage ref="dialogPageRef" />
  </div>
</template>

<style lang="scss" scoped>
:deep() {
  .el-form-item--small.el-form-item {
    width: 100% !important;
  }

  .el-form--inline .el-form-item__content {
    width: 100%;
  }

  .gp-item-01 .el-form-item__content {
    width: 100%;
  }

  .el-textarea__inner {
    resize: none;
  }

  /*
   * v2 是「四边白边框 + 下边框 #dcdfe6」，净效果就是只看得见一条下边线：
   *   .el-textarea__inner / .el-input__inner { border: 1px solid #fff; border-bottom: 1px solid #dcdfe6 }
   * element-plus 把输入框的边框换成了 inset box-shadow —— 输入框在 .el-input__wrapper 上、
   * 文本域在 .el-textarea__inner 上，而且 hover / focus 各有一条覆盖规则，
   * 照搬 border 完全落空，所以 v3 显示的是一圈完整边框。
   * 这里用 `0 -1px 0 0 <色> inset`（内阴影向上偏移 1px，可见的一条正好压在底边）等价还原，
   * 好处是不像 border 那样改变盒子尺寸；三态都覆盖，和 v2 一样 focus 时也不变色。
   */
  .el-input__wrapper,
  .el-input__wrapper:hover,
  .el-input__wrapper.is-focus,
  .el-textarea__inner,
  .el-textarea__inner:hover,
  .el-textarea__inner:focus {
    box-shadow: 0 -1px 0 0 #dcdfe6 inset;
    border-radius: 0;
  }
}

.gm {
  width: 100%;
}

.gm li {
  float: left;
  width: 100%;
}

.gm-left-header {
  width: 100%;
  padding-left: 30px;
}

.gm-right {
  width: 100%;
}

.gm-h1 {
  font-size: 14px;
  color: #808080;
  font-weight: 400;
}

.gm-h2 {
  font-size: 13px;
  color: #888;
  padding-left: 5px;
}

.gm-right-prompt {
  font-size: 13px;
  background-color: #f7f9fe;
  padding: 10px;
  color: #808080;
  position: absolute;
  bottom: 10px;
  line-height: 28px;
  margin-left: 30px;
  margin-right: 20px;
}

.gm-input-01 {
  border: none !important;
  border-bottom: 1px solid #aaa;
}
</style>
