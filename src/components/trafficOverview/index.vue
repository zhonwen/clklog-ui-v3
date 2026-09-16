<script setup lang="ts">
/**
 * 流量概览的「表头一行」（v2 src/components/trafficOverview/index.vue）。
 *
 * 只负责渲染一排标题，数值行由各业务页自己在下面跟着渲染，
 * 两边靠同一个 width 百分比对齐列宽。
 */
// 注意：<script setup> 不允许出现 ES module export，这里只能声明为局部类型；
// 调用方（各业务页的流量概览）自己按 { name, tip? } 声明同形状的字面量即可。
interface TrafficOverviewLabel {
  name: string
  /** 问号气泡里的富文本；v2 里整段 el-popover 被注释掉了，当前没有渲染出口 */
  tip?: string
}

withDefaults(
  defineProps<{
    labelList?: TrafficOverviewLabel[]
    width?: number | string
    /**
     * v2 的调用方（collapse-analysis 的 trafficOverview.vue / collapseDetail-dialog.vue）
     * 都会传 :overviewList，但 v2 组件里并没有声明这个 prop，它只是落到根节点上的一个透传属性。
     * 这里显式声明出来（组件内部同样不使用），只为避免把数组渲染成 DOM 上的垃圾属性。
     */
    overviewList?: unknown[]
  }>(),
  {
    labelList: () => [],
    width: 16,
    overviewList: () => [],
  },
)
</script>

<template>
  <div class="zc_overview">
    <div class="bid-list-headeded">
      <div
        v-for="(item, index) in labelList"
        :key="index"
        class="header-name w156"
        :style="{ width: width + '%' }"
      >
        {{ item.name }}
        <div class="parentPosition">
          <!-- v2 里这段问号气泡是注释掉的，原样保留，便于后续需要时恢复：
          <el-popover placement="bottom-start" width="200" trigger="hover" class="popImg">
            <div v-html="item.tip" style="padding: 5px; font-size: 12px"></div>
            <template #reference>
              <img class="icon-question" src="@/assets/images/question.png" alt="" />
            </template>
          </el-popover>
          -->
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.zc_overview {
  .bid-list-headeded {
    padding-bottom: 10px;
    padding-top: 15px;
    display: flex;

    .header-name {
      justify-content: center;
      height: 30px;
      display: flex;
      align-items: center;
    }

    .w156 {
      font-size: 15px;
      font-weight: 400;
      line-height: 16px;
      color: #4d4d4d;
    }

    img {
      width: 11.44px;
      height: 11.44px;
      margin-left: 12px;
      cursor: pointer;
    }
  }

  .parentPosition {
    position: relative;

    .popImg {
      position: absolute;
      left: 0;
      transform: translate(0, -50%); //左右上下
    }
  }
}
</style>
