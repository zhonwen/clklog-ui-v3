<template>
  <div class="container">
    <div v-show="showFlagPage" class="rules-group-container tree box">
      <div class="box-card" style="margin-top: 10px">
        <div style="padding: 10px; position: relative">
          <el-row>
            <div class="titleHead" style="position: absolute; top: 10px; z-index: 100">
              事件指标：
            </div>
            <template v-for="(item, index) in modelObject.measures" :key="'condition' + index">
              <div>
                <div
                  class="childRows"
                  style="
                    display: flex;
                    flex-direction: column;
                    margin-bottom: 5px;
                    position: relative;
                  "
                >
                  <!-- 一级条件样式 -->
                  <div style="margin-left: 58px; display: flex; align-items: center">
                    <div class="eg_letters" style="margin-right: 0">
                      {{ getLetterByIndex(index) }}
                    </div>
                    <el-input
                      v-if="item.editNameFlag"
                      :ref="(el: unknown) => setTestInputRef(index, el)"
                      v-model="item.name"
                      :autofocus="true"
                      style="width: 200px"
                      class="custom_input"
                      @blur="editCancle(item)"
                    />
                    <div
                      v-show="!item.editNameFlag"
                      class="custom_name"
                      style="
                        color: #656464;
                        font-size: 14px;
                        min-width: 100px;
                        max-width: 400px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        padding-right: 18px;
                        position: relative;
                      "
                    >
                      {{ item.name }}
                    </div>
                    <el-icon
                      v-show="!item.editNameFlag"
                      class="edit-icon"
                      style="color: #2c7be5; cursor: pointer; position: relative; left: 0"
                      @click="editCustomName(item, index)"
                    >
                      <Edit />
                    </el-icon>
                  </div>

                  <div class="pointer_spacing" style="display: flex; align-items: center">
                    <el-cascader
                      :key="'cascader_one-' + index"
                      :ref="(el: unknown) => setCascaderOneRef(index, el)"
                      v-model="item.eventName"
                      :options="protoOptions"
                      :show-all-levels="false"
                      style="font-size: 13px"
                      class="custom_cascader"
                      filterable
                      :props="cascaderOneProps"
                      @change="fileterCascader(item, index)"
                    />
                    <div class="default_font" style="margin: 0 5px; color: gray">的</div>
                    <div style="position: relative">
                      <el-cascader
                        :key="'setCascader-' + index + '-' + item.eventName"
                        v-model="item.casList"
                        :teleported="false"
                        :options="casOptions(item.eventName)"
                        :props="cascaderTwoProps"
                        separator="的"
                        style="font-size: 13px"
                        filterable
                        class="cascader_border"
                        @change="filterDataType(item, index, $event)"
                      />
                    </div>
                    <el-icon
                      v-show="modelObject.measures.length > 1"
                      class="delete_btn"
                      @click="modelObject.measures.splice(index, 1)"
                    >
                      <Close />
                    </el-icon>
                  </div>
                  <div
                    v-if="item.filter.filters.length > 0"
                    style="
                      position: relative;
                      display: flex;
                      flex-direction: column;
                      justify-content: center;
                      height: 100%;
                    "
                  >
                    <div
                      v-if="item.filter.filters.length > 1"
                      style="
                        color: gray;
                        font-size: 13px;
                        position: absolute;
                        left: 73px;
                        height: calc(100% - 15px);
                        display: flex;
                        top: 15px;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        z-index: 666;
                      "
                    >
                      <div class="btn_line" />
                      <el-radio-group
                        v-model="item.filter.relation"
                        size="small"
                        class="custom_btn"
                        @change="changeRadio()"
                      >
                        <el-radio-button value="and">且</el-radio-button>
                        <el-radio-button value="or">或</el-radio-button>
                      </el-radio-group>
                      <div class="btn_line" />
                    </div>

                    <div
                      v-for="(secondP_item, secondP_index) in item.filter.filters"
                      :key="secondP_index"
                      style="position: relative"
                    >
                      <div v-if="secondP_item.conditions.length > 1">
                        <!-- /* left: 140px; */ -->
                        <div
                          class="letter_lower"
                          style="
                            position: absolute;
                            left: 110px;
                            display: flex;
                            align-items: center;
                            height: calc(100% + 15px);
                          "
                        >
                          {{ getLetterLowercase(secondP_index) }}
                        </div>
                        <!-- left: 150px; -->
                        <div
                          style="
                            color: gray;
                            font-size: 10px;
                            position: absolute;
                            left: 120px;
                            display: flex;
                            height: calc(100% - 15px);
                            top: 15px;
                            flex-direction: column;
                            justify-content: center;
                            align-items: center;
                            z-index: 666;
                          "
                        >
                          <div class="btn_line" />
                          <el-radio-group
                            v-model="secondP_item.relation"
                            size="small"
                            class="custom_btn"
                          >
                            <el-radio-button value="and">且</el-radio-button>
                            <el-radio-button value="or">或</el-radio-button>
                          </el-radio-group>
                          <div class="btn_line" />
                        </div>
                      </div>
                      <div
                        v-for="(second_item, second_index) in secondP_item.conditions"
                        :key="second_index"
                        class="pointer_spacing"
                        style="margin-left: 113px; position: relative"
                      >
                        <div v-if="secondP_item.conditions.length > 1">
                          <div
                            style="
                              display: flex;
                              padding-top: 10px;
                              align-items: flex-start;
                              margin-left: 45px;
                            "
                          >
                            <el-select
                              :ref="
                                (el: unknown) =>
                                  setSelectRef(
                                    conditionKey(index, secondP_index, second_index),
                                    el,
                                  )
                              "
                              v-model="second_item.field"
                              class="custom_select"
                              :class="getClasses(second_index)"
                              filterable
                              :no-data-text="''"
                              style="
                                min-width: 100px;
                                height: 32px;
                                margin-right: 15px;
                                position: relative;
                              "
                              placeholder="请选择"
                              @visible-change="
                                handleVisibleChange($event, secondP_item, second_index)
                              "
                              @change="
                                resetSelectDropdownScroll(
                                  conditionKey(index, secondP_index, second_index),
                                )
                              "
                            >
                              <div style="height: 40px; width: 100%">
                                <el-radio-group
                                  v-model="second_item.fieldType"
                                  class="custom_tabs setRadio"
                                  style="
                                    position: absolute;
                                    width: calc(100% - 15px);
                                    background-color: #fff;
                                    top: 0;
                                    z-index: 600;
                                  "
                                  @change="
                                    resetSelectDropdownScroll(
                                      conditionKey(index, secondP_index, second_index),
                                    )
                                  "
                                >
                                  <el-radio-button
                                    value="event_property"
                                    style="margin: 6px 10px 15px 10px"
                                    >事件属性</el-radio-button
                                  >
                                  <el-radio-button value="user_property">用户属性</el-radio-button>
                                </el-radio-group>
                              </div>
                              <el-option
                                v-for="x in checkbtnPoint(second_item.fieldType, item.eventName)"
                                :key="x.name"
                                style="min-width: 250px"
                                :label="x.displayName"
                                :value="x.name"
                              >
                                <div
                                  @click="
                                    checkpointProtoFrom(
                                      x,
                                      second_item.fieldType,
                                      secondP_item,
                                      second_index,
                                    )
                                  "
                                >
                                  {{ x.displayName }}
                                </div>
                              </el-option>
                              <template #empty>
                                <div
                                  v-if="
                                    checkbtnPoint(second_item.fieldType, item.eventName).length == 0
                                  "
                                >
                                  <div class="empty-text" style="min-width: 250px">
                                    <el-radio-group
                                      v-model="second_item.fieldType"
                                      class="custom_tabs"
                                      style="display: flex"
                                    >
                                      <el-radio-button
                                        value="event_property"
                                        style="margin: 0 10px 0 10px"
                                        >事件属性</el-radio-button
                                      >
                                      <el-radio-button value="user_property"
                                        >用户属性</el-radio-button
                                      >
                                    </el-radio-group>
                                  </div>
                                  <div class="select_empty">暂无数据</div>
                                </div>
                              </template>
                            </el-select>
                            <el-select
                              v-model="second_item.function"
                              placeholder="请选择"
                              style="width: 100px"
                              @change="checkRelativeTime(second_item)"
                            >
                              <el-option
                                v-for="x in checkJudgmentType(second_item)"
                                :key="x.name"
                                :label="x.displayName"
                                :value="x.name"
                              >
                                {{ x.displayName }}
                              </el-option>
                            </el-select>
                            <div v-if="filterIstrue(second_item.function)">
                              <el-select
                                v-model="second_item.params"
                                style="margin-left: 10px; min-height: 30px; min-width: 350px"
                                class="second_select"
                                multiple
                                filterable
                                allow-create
                                default-first-option
                                placeholder=""
                              >
                                <el-option v-for="x in second_item.params" :key="x" :label="String(x)" :value="x">
                                  {{ x }}
                                </el-option>
                              </el-select>
                            </div>
                            <!-- 封装组件 -->
                            <condition-option :condition="second_item" />

                            <el-icon
                              class="delete_btn"
                              style="line-height: 30px"
                              @click="
                                threeDeleteEvent(secondP_index, second_index, item.filter.filters)
                              "
                            >
                              <Close />
                            </el-icon>
                          </div>
                          <div
                            v-if="secondP_item.conditions.length == second_index + 1"
                            style="display: flex; margin-left: 45px"
                          >
                            <span
                              class="add-filter-btn"
                              style="padding: 0px 0 0 0"
                              @click="equalityEvent(secondP_index, item.filter)"
                            >
                              <el-icon><Plus /></el-icon>添加过滤条件
                            </span>
                          </div>
                        </div>
                        <div v-else>
                          <div style="display: flex; padding-top: 10px; align-items: flex-start">
                            <div class="letter_lower" style="margin-right: 7px">
                              {{ getLetterLowercase(secondP_index) }}
                            </div>
                            <el-select
                              :ref="
                                (el: unknown) =>
                                  setSelectRef(
                                    conditionSingleKey(index, secondP_index, second_index),
                                    el,
                                  )
                              "
                              v-model="second_item.field"
                              class="custom_select"
                              filterable
                              :no-data-text="''"
                              style="
                                min-width: 100px;
                                height: 32px;
                                position: relative;
                                margin-right: 15px;
                              "
                              placeholder="请选择"
                              @visible-change="
                                handleVisibleChange($event, secondP_item, second_index)
                              "
                              @change="
                                resetSelectDropdownScroll(
                                  conditionSingleKey(index, secondP_index, second_index),
                                )
                              "
                            >
                              <div style="height: 40px; width: 100%">
                                <el-radio-group
                                  v-model="second_item.fieldType"
                                  class="custom_tabs"
                                  style="
                                    position: absolute;
                                    width: calc(100% - 15px);
                                    background-color: #fff;
                                    top: 0;
                                    z-index: 600;
                                  "
                                  @change="
                                    resetSelectDropdownScroll(
                                      conditionSingleKey(index, secondP_index, second_index),
                                    )
                                  "
                                >
                                  <el-radio-button
                                    value="event_property"
                                    style="margin: 6px 10px 15px 10px"
                                    >事件属性</el-radio-button
                                  >
                                  <el-radio-button value="user_property">用户属性</el-radio-button>
                                </el-radio-group>
                              </div>
                              <!-- bug属性 -->
                              <el-option
                                v-for="x in checkbtnPoint(second_item.fieldType, item.eventName)"
                                :key="x.propertyId"
                                style="min-width: 250px"
                                :label="x.displayName"
                                :value="x.name"
                              >
                                <div
                                  @click="
                                    checkpointProtoFrom(
                                      x,
                                      second_item.fieldType,
                                      secondP_item,
                                      second_index,
                                    )
                                  "
                                >
                                  {{ x.displayName }}
                                </div>
                              </el-option>
                              <template #empty>
                                <div
                                  v-if="
                                    checkbtnPoint(second_item.fieldType, item.eventName).length == 0
                                  "
                                >
                                  <div class="empty-text" style="min-width: 250px">
                                    <el-radio-group
                                      v-model="second_item.fieldType"
                                      class="custom_tabs"
                                      style="display: flex"
                                    >
                                      <el-radio-button
                                        value="event_property"
                                        style="margin: 0 10px 0 10px"
                                        >事件属性</el-radio-button
                                      >
                                      <el-radio-button value="user_property"
                                        >用户属性</el-radio-button
                                      >
                                    </el-radio-group>
                                  </div>
                                  <div class="select_empty">暂无数据</div>
                                </div>
                              </template>
                            </el-select>

                            <el-select
                              v-model="second_item.function"
                              placeholder="请选择"
                              style="width: 140px"
                              @change="checkRelativeTime(second_item)"
                            >
                              <el-option
                                v-for="x in checkJudgmentType(second_item)"
                                :key="x.name"
                                :label="x.displayName"
                                :value="x.name"
                              >
                                <div @click="filterPiPei(second_item)">
                                  {{ x.displayName }}
                                </div>
                              </el-option>
                            </el-select>

                            <!-- 区间 正则 匹配规则 -->
                            <condition-option :condition="second_item" />

                            <div v-if="filterIstrue(second_item.function)">
                              <el-select
                                v-model="second_item.params"
                                style="margin-left: 15px; min-width: 350px"
                                multiple
                                filterable
                                allow-create
                                default-first-option
                                placeholder=""
                              >
                                <el-option v-for="x in second_item.params" :key="x" :label="String(x)" :value="x">
                                  {{ x }}
                                </el-option>
                              </el-select>
                            </div>
                            <el-icon
                              class="delete_btn"
                              @click="deleteFirstCondition(item.filter, secondP_index, 1)"
                            >
                              <Close />
                            </el-icon>
                          </div>
                          <div v-if="item.filter.filters.length > 1" style="display: flex">
                            <!-- 增加默认值 -->
                            <span
                              class="add-filter-btn"
                              style="padding: 0px 0 0 13px"
                              @click="secondLevelEvent(secondP_index, item.filter)"
                            >
                              <el-icon><Plus /></el-icon>添加过滤条件
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- 一级 增加默认值 -->
                  <div
                    v-if="protoList.length > 0"
                    style="display: flex; margin-top: 5px; margin-bottom: 8px"
                  >
                    <span
                      class="add-filter-btn pointer_spacing"
                      @click="firstLevelEvent(item.filter, item.eventName)"
                    >
                      <el-icon><Plus /></el-icon>添加过滤条件
                    </span>
                  </div>
                </div>
              </div>
            </template>
            <div class="circle add_icon pointer_spacing" @click="circleAddEvent()" />
          </el-row>
        </div>
        <!-- 维度模块内容 -->
        <div
          class="titleHead"
          style="
            padding: 0 10px;
            margin-top: 15px;
            display: flex;
            align-items: flex-start;
            line-height: 30px;
          "
        >
          <p class="headTitle">查看维度：</p>
          <div v-if="modelObject.byFields.length >= 0" style="display: flex; flex-wrap: wrap">
            <div v-for="(dimenItem, index) in modelObject.byFields" :key="index">
              <el-select
                :ref="(el: unknown) => setSelectRef(dimensionKey(index), el)"
                v-model="dimenItem.field"
                class="custom_select"
                filterable
                :no-data-text="''"
                style="min-width: 100px; height: 32px; position: relative; margin-bottom: 10px"
                placeholder="请选择"
                @visible-change="
                  handleVisibleDimension($event, dimenItem.fieldType, modelObject.byFields, index)
                "
                @change="resetSelectDropdownScroll(dimensionKey(index))"
              >
                <div style="height: 40px; width: 100%">
                  <el-radio-group
                    v-model="dimenItem.fieldType"
                    class="custom_tabs"
                    style="
                      position: absolute;
                      width: calc(100% - 15px);
                      background-color: #fff;
                      top: 0;
                      z-index: 600;
                    "
                    @change="resetSelectDropdownScroll(dimensionKey(index))"
                  >
                    <el-radio-button value="event_property" style="margin: 6px 10px 15px 10px"
                      >事件属性</el-radio-button
                    >
                    <el-radio-button value="user_property">用户属性</el-radio-button>
                  </el-radio-group>
                </div>
                <!-- 维度list -->
                <el-option
                  v-for="x in checkDimensionTest(dimenItem)"
                  :key="x.name"
                  style="min-width: 250px"
                  :label="x.displayName"
                  :value="x.name"
                >
                  <div
                    @click="checkDimensioFrom(dimenItem.fieldType, modelObject.byFields, index, x)"
                  >
                    {{ x.displayName }}
                  </div>
                </el-option>
                <template #empty>
                  <div v-if="checkDimensionTest(dimenItem).length == 0">
                    <div class="empty-text" style="min-width: 250px">
                      <el-radio-group
                        v-model="dimenItem.fieldType"
                        class="custom_tabs"
                        style="display: flex"
                      >
                        <el-radio-button value="event_property" style="margin: 0 10px 0 10px"
                          >事件属性</el-radio-button
                        >
                        <el-radio-button value="user_property">用户属性</el-radio-button>
                      </el-radio-group>
                    </div>
                    <div class="select_empty">暂无数据</div>
                  </div>
                </template>
              </el-select>
              <el-icon class="delete_btn" @click="modelObject.byFields.splice(index, 1)">
                <Close />
              </el-icon>
            </div>
            <div
              class="circle"
              :style="modelObject.byFields.length == 1 ? 'margin-left:20px;' : ''"
              @click="addDemisionObj()"
            />
          </div>
        </div>
        <!-- 全局筛选 -->
        <div
          class="titleHead"
          style="
            padding: 0 10px;
            margin-top: 25px;
            display: flex;
            align-items: flex-start;
            position: relative;
          "
        >
          <p class="headTitle">全局筛选：</p>
          <el-row>
            <div
              v-if="modelObject.filter.filters.length > 1"
              style="
                color: gray;
                font-size: 13px;
                position: absolute;
                left: 0px;
                height: calc(100% - 15px);
                display: flex;
                top: 0px;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 666;
              "
            >
              <div class="btn_line" />
              <el-radio-group
                v-model="modelObject.filter.relation"
                size="small"
                class="custom_btn"
                @change="changeRadio()"
              >
                <el-radio-button value="and">且</el-radio-button>
                <el-radio-button value="or">或</el-radio-button>
              </el-radio-group>
              <div class="btn_line" />
            </div>

            <div v-if="modelObject.filter.filters.length > 0">
              <div
                v-for="(secondP_item, secondP_index) in modelObject.filter.filters"
                :key="secondP_index"
                style="position: relative"
              >
                <div v-if="secondP_item.conditions.length > 1">
                  <div
                    class="letter_lower"
                    style="
                      position: absolute;
                      left: 40px;
                      display: flex;
                      align-items: center;
                      height: calc(100% - 15px);
                    "
                  >
                    {{ getLetterByIndex(secondP_index) }}
                  </div>
                  <div
                    style="
                      color: gray;
                      font-size: 13px;
                      position: absolute;
                      left: 50px;
                      display: flex;
                      height: calc(100% - 15px);
                      top: 0px;
                      flex-direction: column;
                      justify-content: center;
                      align-items: center;
                      z-index: 666;
                    "
                  >
                    <div class="btn_line" />
                    <el-radio-group v-model="secondP_item.relation" size="small" class="custom_btn">
                      <el-radio-button value="and">且</el-radio-button>
                      <el-radio-button value="or">或</el-radio-button>
                    </el-radio-group>
                    <div class="btn_line" />
                  </div>
                </div>
                <div
                  v-for="(second_item, second_index) in secondP_item.conditions"
                  :key="second_index"
                  style="display: flex; margin-bottom: 10px"
                  :style="
                    modelObject.filter.filters.length == 1 &&
                    (modelObject.filter.filters[0]?.conditions.length ?? 0) < 2
                      ? 'margin-left: 0px;'
                      : 'margin-left: 40px;'
                  "
                >
                  <div v-if="secondP_item.conditions.length > 1">
                    <div
                      style="
                        display: flex;
                        padding-top: 0px;
                        align-items: flex-start;
                        margin-left: 45px;
                      "
                    >
                      <el-select
                        :ref="
                          (el: unknown) => setSelectRef(globalKey(secondP_index, second_index), el)
                        "
                        v-model="second_item.field"
                        class="custom_select"
                        filterable
                        :no-data-text="''"
                        style="min-width: 100px; height: 32px; position: relative"
                        placeholder="请选择"
                        @visible-change="
                          handleVisibleChangeNew($event, secondP_item, second_index)
                        "
                        @change="
                          resetSelectDropdownScroll(globalKey(secondP_index, second_index))
                        "
                      >
                        <div style="height: 40px; width: 100%">
                          <!-- 全局筛选 用户回显 -->
                          <el-radio-group
                            v-model="second_item.fieldType"
                            class="custom_tabs"
                            style="
                              position: absolute;
                              width: calc(100% - 15px);
                              background-color: #fff;
                              top: 0;
                              z-index: 600;
                            "
                            @change="
                              resetSelectDropdownScroll(globalKey(secondP_index, second_index))
                            "
                          >
                            <el-radio-button
                              value="event_property"
                              style="margin: 6px 10px 15px 10px"
                              >事件属性</el-radio-button
                            >
                            <el-radio-button value="user_property">用户属性</el-radio-button>
                          </el-radio-group>
                        </div>
                        <el-option
                          v-for="x in checkDimensionTest(second_item)"
                          :key="x.name"
                          style="min-width: 250px"
                          :label="x.displayName"
                          :value="x.name"
                        >
                          <div
                            @click="
                              checkprototypeFromNew(
                                x,
                                second_item.fieldType,
                                secondP_item,
                                second_index,
                              )
                            "
                          >
                            {{ x.displayName }}
                          </div>
                        </el-option>
                        <template #empty>
                          <div v-if="checkDimensionTest(second_item).length == 0">
                            <div class="empty-text" style="min-width: 250px">
                              <el-radio-group
                                v-model="second_item.fieldType"
                                class="custom_tabs"
                                style="display: flex"
                              >
                                <el-radio-button
                                  value="event_property"
                                  style="margin: 0 10px 0 10px"
                                  >事件属性</el-radio-button
                                >
                                <el-radio-button value="user_property">用户属性</el-radio-button>
                              </el-radio-group>
                            </div>
                            <div class="select_empty">暂无数据</div>
                          </div>
                        </template>
                      </el-select>
                      <el-select
                        v-model="second_item.function"
                        placeholder="请选择"
                        style="width: 100px; margin-left: 15px"
                        @change="handleFunctionChange(second_item)"
                      >
                        <el-option
                          v-for="x in filterGlobalSelect(second_item)"
                          :key="x.name"
                          :label="x.displayName"
                          :value="x.name"
                        >
                          <div>
                            {{ x.displayName }}
                          </div>
                        </el-option>
                      </el-select>
                      <div v-if="filterIstrue(second_item.function)">
                        <el-select
                          v-model="second_item.params"
                          style="margin-left: 10px; min-height: 30px; min-width: 350px"
                          class="second_select"
                          multiple
                          filterable
                          allow-create
                          default-first-option
                          placeholder=""
                        >
                          <el-option v-for="x in second_item.params" :key="x" :label="String(x)" :value="x" />
                        </el-select>
                      </div>
                      <condition-option :condition="second_item" />
                      <el-icon
                        class="delete_btn"
                        style="line-height: 30px"
                        @click="
                          threeDeleteEvent(
                            secondP_index,
                            second_index,
                            modelObject.filter.filters,
                          )
                        "
                      >
                        <Close />
                      </el-icon>
                    </div>
                    <div
                      v-if="secondP_item.conditions.length == second_index + 1"
                      style="display: flex; margin-left: 45px"
                    >
                      <span
                        class="add-filter-btn"
                        style="padding: 0px 0 0 0"
                        @click="equalityEvent(secondP_index, modelObject.filter, 'gloab')"
                      >
                        <el-icon><Plus /></el-icon>添加过滤条件
                      </span>
                    </div>
                  </div>
                  <div v-else>
                    <div style="display: flex; padding-top: 0px; align-items: flex-start">
                      <div class="letter_lower" style="margin-right: 7px">
                        {{ getLetterByIndex(secondP_index) }}
                      </div>
                      <el-select
                        :ref="
                          (el: unknown) => setSelectRef(globalKey(secondP_index, second_index), el)
                        "
                        v-model="second_item.field"
                        class="custom_select"
                        filterable
                        :no-data-text="''"
                        style="min-width: 100px; height: 32px; position: relative"
                        placeholder="请选择"
                        @visible-change="
                          handleVisibleChangeNew($event, secondP_item, second_index)
                        "
                        @change="
                          resetSelectDropdownScroll(globalKey(secondP_index, second_index))
                        "
                      >
                        <div style="height: 40px; width: 100%">
                          <!-- 全局筛选 用户回显 -->
                          <el-radio-group
                            v-model="second_item.fieldType"
                            class="custom_tabs"
                            style="
                              position: absolute;
                              width: calc(100% - 15px);
                              background-color: #fff;
                              top: 0;
                              z-index: 600;
                            "
                            @change="
                              resetSelectDropdownScroll(globalKey(secondP_index, second_index))
                            "
                          >
                            <el-radio-button
                              value="event_property"
                              style="margin: 6px 10px 15px 10px"
                              >事件属性</el-radio-button
                            >
                            <el-radio-button value="user_property">用户属性</el-radio-button>
                          </el-radio-group>
                        </div>
                        <el-option
                          v-for="x in checkDimensionTest(second_item)"
                          :key="x.name"
                          style="min-width: 250px"
                          :label="x.displayName"
                          :value="x.name"
                        >
                          <div
                            @click="
                              checkprototypeFromNew(
                                x,
                                second_item.fieldType,
                                secondP_item,
                                second_index,
                              )
                            "
                          >
                            {{ x.displayName }}
                          </div>
                        </el-option>
                        <template #empty>
                          <div v-if="checkDimensionTest(second_item).length == 0">
                            <div class="empty-text" style="min-width: 250px">
                              <el-radio-group
                                v-model="second_item.fieldType"
                                class="custom_tabs"
                                style="display: flex"
                              >
                                <el-radio-button
                                  value="event_property"
                                  style="margin: 0 10px 0 10px"
                                  >事件属性</el-radio-button
                                >
                                <el-radio-button value="user_property">用户属性</el-radio-button>
                              </el-radio-group>
                            </div>
                            <div class="select_empty">暂无数据</div>
                          </div>
                        </template>
                      </el-select>

                      <el-select
                        v-model="second_item.function"
                        placeholder="请选择"
                        style="width: 100px; margin-left: 15px"
                        @change="handleFunctionChange(second_item)"
                      >
                        <el-option
                          v-for="x in filterGlobalSelect(second_item)"
                          :key="x.name"
                          :label="x.displayName"
                          :value="x.name"
                        >
                          <div>
                            {{ x.displayName }}
                          </div>
                        </el-option>
                      </el-select>
                      <div v-if="filterIstrue(second_item.function)">
                        <el-select
                          v-model="second_item.params"
                          style="margin-left: 15px; min-width: 350px"
                          multiple
                          filterable
                          allow-create
                          default-first-option
                          placeholder=""
                        >
                          <el-option v-for="x in second_item.params" :key="x" :label="String(x)" :value="x">
                            {{ x }}
                          </el-option>
                        </el-select>
                      </div>
                      <!-- 封装组件 -->
                      <condition-option :condition="second_item" />
                      <el-icon class="delete_btn" @click="gloabDeleteEvent(secondP_index)">
                        <Close />
                      </el-icon>
                    </div>
                    <div v-if="modelObject.filter.filters.length > 1" style="display: flex">
                      <span
                        class="add-filter-btn"
                        style="padding: 0px 0 0 13px"
                        @click="secondLevelEvent(secondP_index, modelObject.filter, 'gloab')"
                      >
                        <el-icon><Plus /></el-icon>添加过滤条件
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- 初始为空 -->
            <div
              v-if="modelObject.filter.filters.length == 0"
              class="circle"
              @click="gloabAddEvent()"
            />
            <div v-else style="display: flex">
              <span
                class="add-filter-btn"
                :style="
                  modelObject.filter.filters.length == 1 &&
                  (modelObject.filter.filters[0]?.conditions.length ?? 0) < 2
                    ? 'padding-left:0'
                    : ' '
                "
                @click="gloabAddEvent()"
              >
                <el-icon><Plus /></el-icon>添加过滤条件
              </span>
            </div>
          </el-row>
        </div>
      </div>
      <el-button
        v-loading="startLoading"
        class="zc_btn"
        style="margin: 30px 105px"
        @click="startAnalysis()"
        >开始分析</el-button
      >
    </div>
    <div
      style="
        color: #2c7be5;
        font-size: 12px;
        display: flex;
        justify-content: center;
        cursor: pointer;
      "
      @click="isOpenEvent()"
    >
      {{ showFlagPage ? '收起' : '展开' }}
      <el-icon>
        <ArrowUp v-if="showFlagPage" />
        <ArrowDown v-else />
      </el-icon>
    </div>
    <dialogMsgError ref="dialogMsgErrorRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { CascaderOption, CascaderProps } from 'element-plus'
import { ArrowDown, ArrowUp, Close, Edit, Plus } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { copyObj } from '@/utils/copy'
import { bus } from '@/utils/event-bus'
import { CUSTOM_ANALYSIS_PATH } from '@/router/paths'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import {
  getCommonPropertyListApi,
  getGroupedPropertiesApi,
  getListNoGroupEventApi,
} from '@/api/sysmanage/manageEvent'
import { customAnalysisApi } from '@/api/sysmanage/customAnalysis'
import { getApi } from '@/api/sysmanage/bookMark'
import {
  defaultType,
  getOptionsByType,
  NumberType,
  noNumber,
  type OptionDef,
} from '@/utils/modelOptions/custom'
import { mergeCommonPropertiesToEvents } from '@/utils/mergeEventProperties'
import conditionOption from './conditionOption.vue'
import dialogMsgError from './dialogMsgError.vue'
import type {
  BookmarkTag,
  CascaderNode,
  CommonPropertyData,
  ConditionItem,
  CustomAnalysisData,
  CustomFilterBarParams,
  EventGroup,
  FieldType,
  FilterGroup,
  FilterModel,
  MeasureItem,
  ModelObject,
  PropertyItem,
  ResultDetail,
} from '../types'

defineOptions({ name: 'CreateRule' })

const emit = defineEmits<{
  (e: 'customListEvent', val: ResultDetail, modelObject: ModelObject): void
  (e: 'customLoading', flag: boolean | string): void
  (e: 'addTagStore', model: ModelObject, flag: string): void
  (e: 'bookmarkRefresh'): void
}>()

const route = useRoute()
const router = useRouter()
const trackingStore = useTrackingStore()
const projectName = computed(() => trackingStore.projectName)

// 每个取数函数各自一套序号：同一套会互相把对方判成「过期」，
// 比如 getListEventPrototype('用户') 和 ('事件') 是两次并发请求，必须分开计数。
const latestAnalysis = useLatestOnly()
const latestProto = useLatestOnly()
const latestUserProp = useLatestOnly()
const latestEventProp = useLatestOnly()
const latestCommonProp = useLatestOnly()
const latestBookmark = useLatestOnly()

// ===== 组件状态（字段名与 v2 的 data 一一对应）=====
const scrollPosition = ref(0)
const startLoading = ref(false)
const showFlagPage = ref(true)
const commonParams = ref<CustomFilterBarParams>({
  startTime: '',
  endTime: '',
  timeFlag: '',
  timeType: '',
  groupName: '',
})
/** 指标事件属性 */
const eventProtoList = ref<PropertyItem[]>([])
/** 指标用户属性 */
const userProtoList = ref<PropertyItem[]>([])
/** 事件指标名称（分组后的事件树） */
const protoList = ref<EventGroup[]>([])
/** 共用事件属性 */
const commonPropertySum = ref<PropertyItem[]>([])
/** 共用用户属性 */
const userProperties = ref<PropertyItem[]>([])
const initSelectObj = ref<PropertyItem | null>({
  dataType: '',
  displayName: '',
  name: '',
  propertyId: '',
})

// 下面这些在 v2 里同样挂在 data 上，但只在方法之间流转、不参与渲染，
// 用普通变量承接即可（尤其 default_prototype 是在 render 期间被 checkbtnPoint 写入的，
// 做成 ref 会在渲染过程中触发额外的响应式写入）。
let oldProject = ''
let oldProperty: FieldType | undefined
let eventType = ''
let pointerDefaultMeasureName = ''
let default_prototype: PropertyItem | null = null
let initSumApi = 1
// v2 里赋值后由 clearInitBook 消费，该函数在 v2 从未被调用；保留赋值链路，加 _ 前缀让 lint 放行
let _bookmarkInitObj: ModelObject | null = null

const default_options = defaultType
// 与 v2 一致：defaultType[0].name 即「总次数 general」
const pointerDefaultOne = defaultType[0]?.name ?? 'general'

// v2 的 :props="{ value:'name', label:'displayName', children:'events', multiple:false, emitPath:false }"
const cascaderOneProps: CascaderProps = {
  value: 'name',
  label: 'displayName',
  children: 'events',
  multiple: false,
  emitPath: false,
}
// v2 的 :props="{ value:'name', label:'displayName', children:'events', multiple:false }"
const cascaderTwoProps: CascaderProps = {
  value: 'name',
  label: 'displayName',
  children: 'events',
  multiple: false,
}

function createEmptyModel(withTimeFlag: boolean): ModelObject {
  const model: ModelObject = {
    byFields: [],
    filter: {
      filters: [],
    },
    measures: [
      {
        eventName: '',
        casList: [],
        defaultMeasureName: '',
        name: '',
        type: 'normal',
        filter: {
          filters: [],
          relation: 'and',
        },
      },
    ],
    startDate: '',
    endDate: '',
    dataType: 'day',
    projectName: '',
  }
  // 与 v2 一致：customInitEvent 里的那份初始模型多带一个 timeFlag: 'day'，
  // projectName watcher 里的那份不带
  if (withTimeFlag) model.timeFlag = 'day'
  return model
}

const modelObject = ref<ModelObject>(createEmptyModel(false))

const dialogMsgErrorRef = ref<InstanceType<typeof dialogMsgError> | null>(null)

// ===== 模板 ref 收集 =====
/** el-input 暴露的 focus */
type FocusableInput = { focus: () => void }
/** el-cascader 暴露的 getCheckedNodes */
type CascaderExposed = {
  getCheckedNodes: (leafOnly: boolean) => { pathLabels: string[] }[] | undefined
}
/** el-select 暴露的下拉滚动条 */
type ScrollableSelect = { scrollbarRef?: { setScrollTop?: (value: number) => void } }

const testInputRefs = new Map<number, FocusableInput>()
const cascaderOneRefs = new Map<number, CascaderExposed>()
const selectRefs = new Map<string, ScrollableSelect>()

function setTestInputRef(index: number, el: unknown) {
  if (el) testInputRefs.set(index, el as FocusableInput)
  else testInputRefs.delete(index)
}

function setCascaderOneRef(index: number, el: unknown) {
  if (el) cascaderOneRefs.set(index, el as CascaderExposed)
  else cascaderOneRefs.delete(index)
}

function setSelectRef(key: string, el: unknown) {
  if (el) selectRefs.set(key, el as ScrollableSelect)
  else selectRefs.delete(key)
}

/**
 * 下拉框的 key。
 * 与 v2 一致（v2 此处逻辑存疑：v2 的 ref 名只有 secondP_index / second_index，
 * 不含指标下标，多个指标时 this.$refs['conditionSelect0-0'] 会是一个数组、代码固定取 [0]，
 * 结果永远滚动的是第一个指标下同位置的那个下拉框。v3 把指标下标一并放进 key，
 * 让「重置当前下拉框滚动条」按本来的意图生效）
 */
function conditionKey(mIndex: number, secondP_index: number, second_index: number) {
  return `conditionSelect-${mIndex}-${secondP_index}-${second_index}`
}
function conditionSingleKey(mIndex: number, secondP_index: number, second_index: number) {
  return `conditionSelectSingle-${mIndex}-${secondP_index}-${second_index}`
}
function globalKey(secondP_index: number, second_index: number) {
  return `globalSelect-${secondP_index}-${second_index}`
}
function dimensionKey(index: number) {
  return `dimensionSelect-${index}`
}

/** 切换事件属性 / 用户属性后把下拉滚动条拉回顶部 */
function resetSelectDropdownScroll(key: string) {
  void nextTick(() => {
    selectRefs.get(key)?.scrollbarRef?.setScrollTop?.(0)
  })
}

// ===== 指标名编辑 =====
function editCancle(item: MeasureItem) {
  item.editNameFlag = null
}

function editCustomName(item: MeasureItem, index: number) {
  item.editNameFlag = true
  void nextTick(() => {
    // v2 是 this.$refs.testInput[0].focus()：同一时刻只会有一个输入框渲染出来，
    // 取 [0] 和取当前这个指标的输入框等价
    testInputRefs.get(index)?.focus()
  })
}

// ===== 滚动位置保持 =====
function updateScrollPosition() {
  scrollPosition.value = window.scrollY || document.documentElement.scrollTop
}

function scrollToPosition() {
  void nextTick(() => {
    window.scrollTo(0, scrollPosition.value)
  })
}

// ===== 初始事件 =====
function customInitEvent(params: CustomFilterBarParams) {
  commonParams.value = copyObj(params)
  const modelObject_refresh = createEmptyModel(true)
  if (oldProject != params.projectName) {
    modelObject.value = modelObject_refresh
  }
  oldProject = params.projectName ?? ''
  // 只执行一次
  let tagObj: Partial<BookmarkTag> = {}
  if (route.query.query) {
    if (route.query.tagObj) {
      tagObj = JSON.parse(route.query.tagObj as string) as BookmarkTag
    }
    const queryParams = JSON.parse(route.query.query as string) as ModelObject

    // 判断用户是否拥有该项目权限
    const projectArray = trackingStore.projectArray || []
    const isContains = projectArray.some((item) => item.projectName === queryParams.projectName)
    if (isContains) {
      trackingStore.setProject(queryParams.projectName)
    } else {
      ElMessage.error('没有该项目查看权限')
      modelObject.value = modelObject_refresh
      funcCommonEvent()
      return
    }
    if (queryParams.projectName != projectName.value) {
      bus.emit('$CHECKPROJECT', queryParams.projectName)
      return
    } else {
      // 判断标签ID不存在
      if (tagObj.bookmarkId) {
        handleUpdate(tagObj as BookmarkTag)
      }
      modelObject.value = JSON.parse(route.query.query as string) as ModelObject
    }
  }
  funcCommonEvent()
}

function funcCommonEvent() {
  modelObject.value.projectName = commonParams.value.projectName ?? ''
  modelObject.value.startDate = commonParams.value.startTime
  modelObject.value.endDate = commonParams.value.endTime
  modelObject.value.dataType = commonParams.value.timeType
  modelObject.value.timeFlag = commonParams.value.timeFlag
  getPrototype()
  getListEventPrototype('用户') // 获取指标属性
  getListEventPrototype('事件') // 获取指标属性
  getCommonPropertyList() // 维度、全局 属性可选择数据
  initSumApi++
}

/** 书签详情：当前用户没有这个书签时（code 500）让父级换一种刷新策略 */
function handleUpdate(row: BookmarkTag) {
  _bookmarkInitObj = {
    byFields: [],
    filter: {
      filters: [],
    },
    measures: [
      {
        eventName: eventType,
        casList: [pointerDefaultOne],
        aggregator: pointerDefaultOne,
        defaultMeasureName: pointerDefaultMeasureName,
        name: pointerDefaultMeasureName,
        type: 'normal',
        filter: {
          relation: 'and',
          filters: [],
        },
      },
    ],
    startDate: '',
    endDate: '',
    dataType: 'day',
    projectName: '',
  }

  const token = latestBookmark.next()
  getApi({
    bookmarkId: row.bookmarkId,
    projectName: commonParams.value.projectName,
  })
    .then((res) => {
      if (!latestBookmark.isLatest(token)) return
      if (res?.code == 500) {
        console.log('当前用户没有改书签')
        void nextTick(() => {
          // 调用父组件的刷新方法，让父组件决定刷新策略
          emit('bookmarkRefresh')
        })
      }
    })
    .catch(() => {
      /* 与 v2 一致：这里吞掉错误 */
    })
}


function circleAddEvent() {
  modelObject.value.measures.push({
    eventName: eventType,
    casList: [pointerDefaultOne],
    aggregator: pointerDefaultOne,
    defaultMeasureName: pointerDefaultMeasureName,
    name: pointerDefaultMeasureName,
    id: '',
    type: 'normal',
    filter: {
      relation: 'and',
      filters: [],
    },
  })
}

/** 存储标签事件 */
function addTagEvent(val: string) {
  emit('addTagStore', modelObject.value, val)
}

/** 相对时间发生时间 */
function checkRelativeTime(condition: ConditionItem) {
  if (condition.function == 'relative_event_time') {
    condition.params[0] = 'afterDay'
    condition.params[2] = 'day'
  }
}

/** 维度处理来源 */
function addDemisionObj() {
  const sel = initSelectObj.value
  const demisionSing = {
    name: sel?.displayName,
    dataType: sel?.dataType,
    field: sel?.name,
    fieldType: 'event_property' as FieldType,
  }
  modelObject.value.byFields.push(demisionSing)
}

function isOpenEvent() {
  showFlagPage.value = !showFlagPage.value
  bus.emit('$isOpen', showFlagPage.value)
}

// ===== 开始分析 =====
function startAnalysis() {
  emit('customLoading', true)
  startLoading.value = true
  const token = latestAnalysis.next()
  customAnalysisApi(modelObject.value as unknown as Record<string, unknown>)
    .then((res) => {
      if (!latestAnalysis.isLatest(token)) return
      if (res?.code && res.code == 200) {
        startLoading.value = false
        emit('customLoading', false)
        const data = res.data as CustomAnalysisData
        const resultDetail = copyObj(data.resultDetail)

        const byValues: string[] = [] // 维度类型
        const byFields: (string | undefined)[] = []
        modelObject.value.byFields.map((item) => {
          byFields.push(item.dataType)
        })
        modelObject.value.measures.map((item) => {
          // 与 v2 一致：v2 注释掉了 item.defaultMeasureName，用的是自定义名称 item.name
          byValues.push(item.name)
        })
        if (resultDetail.rows.length > 0) {
          resultDetail.rows.map((item) => {
            item.pointList = byValues
            item.byFields = byFields
          })
        }
        resultDetail.rollupResult = data.rollupResult
        // 处理后端空格的数据
        const formatDateRanges = (arr: string[]) => {
          return arr.map((item) => {
            // 检查字符串中是否含有空格
            if (item.includes(' ')) {
              // 将空格替换为~
              const [startDate, endDate] = item.split(' ')
              return `${startDate}~${endDate}`
            }
            return item
          })
        }
        resultDetail.series = formatDateRanges(resultDetail.series)
        // end
        emit('customListEvent', resultDetail, modelObject.value)
      } else {
        // 与 v2 完全一致的结构，包括「这里没有 emit('customLoading', false)」这一点。
        // 与 v2 一致（v2 此处逻辑存疑）：
        //   1) v2 的请求层在 customAnalysis 非 200 时 return undefined，于是 res.code 直接抛
        //      TypeError 被下面的 catch 接住，这个 else 分支实际永远进不来 —— 错误弹窗、
        //      以及 openErrorMsg 里那段「书签内的查询分析模型已变更」的文案从未真正出现过；
        //   2) 正因为如此，v2 漏写的 emit('customLoading', false) 也没暴露出来（catch 里补上了）。
        // v3 的请求层会把 res 原样回传，这个分支于是变成可达：弹窗会显示（这本来就是它的用途），
        // 但父级的 loading 不会被关掉，趋势图/表格上的 spinner 会一直转。【需确认】
        // 若确认要修：在这一行前补 emit('customLoading', false) 即可。
        dialogMsgErrorRef.value?.openErrorMsg(res?.msg || '请求超时')
      }
    })
    .catch(() => {
      if (!latestAnalysis.isLatest(token)) return
      startLoading.value = false
      emit('customLoading', false)
    })
}

/** 通用属性 */
function getCommonPropertyList() {
  const token = latestCommonProp.next()
  getCommonPropertyListApi({
    projectName: modelObject.value.projectName,
  })
    .then((res) => {
      if (!latestCommonProp.isLatest(token)) return
      if (res?.code == 200) {
        const data = res.data as CommonPropertyData
        commonPropertySum.value = [...data.commonProperties, ...data.commonPresetProperties]
        userProperties.value = data.userProperties
        // 与 v2 一致：v2 在这里注释掉了「用 commonPropertySum[0] 设置维度/全局初始选择」的逻辑
      }
    })
    .catch(() => {
      /* 报错已由请求层统一提示 */
    })
}

function getClasses(second_index: number) {
  return `${second_index}addselect`
}

/** 这些判断方式不需要「值」输入框（时间区间、真假、有值没值等自带控件或无需取值） */
function filterIstrue(item?: string) {
  let flag = true
  if (
    item == 'isTrue' ||
    item == 'isFalse' ||
    item == 'isSet' ||
    item == 'notSet' ||
    item == 'isEmpty' ||
    item == 'isNotEmpty' ||
    // 正则匹配
    item == 'between' ||
    item == 'queal' ||
    item == 'notQueal' ||
    // 相对时间
    item == 'absolute_between' ||
    item == 'extract_between' ||
    item == 'relative_within' ||
    item == 'relative_between' ||
    item == 'relative_event_time'
  ) {
    flag = false
  }
  return flag
}

/** 判断联级路径是否仍存在于当前 options */
function isCasPathValid(options: CascaderNode[], path: string[] | undefined) {
  if (!Array.isArray(path) || !path.length) return false
  let current = options || []
  for (let i = 0; i < path.length; i++) {
    const node = current.find((opt) => opt.name === path[i])
    if (!node) return false
    current = node.events || []
  }
  return true
}

function resolveCasPathLabels(options: CascaderNode[], path: string[]) {
  const labels: string[] = []
  let current = options || []
  for (let i = 0; i < path.length; i++) {
    const node = current.find((opt) => opt.name === path[i])
    if (!node) return labels
    labels.push(node.displayName)
    current = node.events || []
  }
  return labels
}

/** 取第一层联级里被选中事件的 pathLabels[1]（分组名在 [0]，事件名在 [1]） */
function readEventLabel(index: number) {
  const cascaderOne = cascaderOneRefs.get(index)?.getCheckedNodes(false)
  const labelOne = (cascaderOne && cascaderOne[0] && cascaderOne[0].pathLabels) || []
  return labelOne[1]
}

/** 切换事件name */
function fileterCascader(item: MeasureItem, index: number) {
  // 新事件下若无旧联级选中值：重置为默认「总次数」，并清掉属性字段
  const options = formateCascader(item.eventName)
  let casReset = false
  if (!isCasPathValid(options, item.casList)) {
    casReset = true
    item.casList = [pointerDefaultOne]
    item.aggregator = pointerDefaultOne
    delete item.field
    delete item.fieldType
  }

  void nextTick(() => {
    const eventLabel = readEventLabel(index)
    if (!eventLabel) return

    const pathLabels = resolveCasPathLabels(formateCascader(item.eventName), item.casList)

    // 仍无有效路径：清空联级与标题
    if (!pathLabels.length) {
      item.casList = []
      delete item.aggregator
      delete item.field
      delete item.fieldType
      item.defaultMeasureName = ''
      item.name = ''
      return
    }

    const nextName =
      pathLabels.length > 1
        ? (eventLabel + '的' + pathLabels[0] + '的' + pathLabels[1]).trim()
        : (eventLabel + '的' + pathLabels[0]).trim()

    // 切换导致重置，或标题仍是自动名：同步标题；用户自定义标题则只更新 defaultMeasureName
    if (casReset || item.defaultMeasureName === item.name) {
      item.defaultMeasureName = nextName
      item.name = nextName
    } else {
      item.defaultMeasureName = nextName
    }
  })
}

/** 模糊搜索选中后：用 $event 路径统一同步字段与标题（默认扁平搜索即可） */
function filterDataType(item: MeasureItem, index: number, event: unknown) {
  const casList = Array.isArray(event)
    ? (event as string[]).slice()
    : (item.casList || []).slice()
  // 确保 v-model 与展示用同一份路径，避免输入框 presentText 慢一拍
  item.casList = casList

  if (casList.length > 1) {
    item.aggregator = casList[1]
    item.field = casList[0]
    item.fieldType = 'event_property'
  } else if (casList.length === 1) {
    item.aggregator = casList[0]
    delete item.field
    delete item.fieldType
  }

  void nextTick(() => {
    const eventLabel = readEventLabel(index)
    if (!eventLabel) return

    const pathLabels = resolveCasPathLabels(formateCascader(item.eventName), casList)
    if (!pathLabels.length) return

    if (pathLabels.length > 1) {
      item.defaultMeasureName = eventLabel + '的' + pathLabels[0] + '的' + pathLabels[1]
      item.name = (eventLabel + '的' + pathLabels[0] + '的' + pathLabels[1]).trim()
    } else {
      item.defaultMeasureName = eventLabel + '的' + pathLabels[0]
      item.name = (eventLabel + '的' + pathLabels[0]).trim()
    }

    // v2 这里还调了一个 syncCascaderPresentText(index)，靠改 Element UI cascader 的内部
    // computePresentContent / inputValue / filtering 强刷回显。element-plus 的 cascader
    // 不再暴露这些内部量（只 expose 了只读的 presentText），并且它自己会跟着 modelValue
    // 重算回显，所以这段 hack 不再需要，迁移时移除。【需确认】
  })
}

/** 切换 */
function checkJudgmentType(val: ConditionItem): OptionDef[] {
  // 与 v2 一致（v2 此处逻辑存疑：原写法 `if (!val && !val.dataType) return options;`
  // —— val 为假时访问 val.dataType 会直接抛错，条件本身也永远不成立）
  let options = getOptionsByType(val.dataType)
  // 用户数据筛选
  if (options.length == 0) {
    options = filterJudgmentType(userProtoList.value, val)
  }
  return options
}

function checkTypeArray(item: PropertyItem) {
  return getOptionsByType(item.dataType)
}

/** 处理函数切换时清空 second_item */
function handleFunctionChange(second_item: ConditionItem) {
  // 清空 second_item 的相关字段
  second_item.params = []
}

function filterGlobalSelect(item: ConditionItem): OptionDef[] {
  let options: OptionDef[] = []
  if (item.fieldType == 'event_property') {
    // 全部数据源
    eventProtoList.value.map((x) => {
      if (x.name == item.field) {
        options = checkTypeArray(x)
      }
    })
  } else {
    // 全部数据源
    userProtoList.value.map((x) => {
      if (x.name == item.field) {
        options = checkTypeArray(x)
      }
    })
  }
  return options
}

function filterPiPei(val: ConditionItem) {
  val.params = []
}

/**
 * 与 v2 一致（v2 此处逻辑存疑：拿整个条件对象 val 去和属性的 name 比较，永远不相等，
 * 这个函数实际恒返回空数组）
 */
function filterJudgmentType(list: PropertyItem[], val: ConditionItem): OptionDef[] {
  let options: OptionDef[] = []
  list.map((item) => {
    if ((item.name as string | ConditionItem) === val) {
      options = getOptionsByType(item.dataType)
    }
  })
  return options
}

/** 切换纬度 / 全局筛选  调整为全部数据 */
function checkDimensionTest(dimenItem: { fieldType?: FieldType }): PropertyItem[] {
  // 与 v2 一致：v2 注释掉了「公共事件属性 commonPropertySum / userProperties」的版本，
  // 现用的是「全部属性」
  if (dimenItem.fieldType == 'event_property') {
    return eventProtoList.value
  } else {
    return userProtoList.value
  }
}

/** 事件名 → 该事件的属性列表 */
const eventPropertyMap = computed(() => {
  const map = new Map<string, PropertyItem[]>()
  protoList.value.forEach((a) => {
    a.events.forEach((b) => {
      map.set(b.name, b.propertyList)
    })
  })
  return map
})

/**
 * select 数据过滤。
 * 注意：这个函数在模板里被调用，且会写入 default_prototype（v2 就是这么做的）。
 * default_prototype 只在事件处理函数里被读，不参与渲染，所以刻意用普通变量而不是 ref。
 */
function checkbtnPoint(fieldType: FieldType | undefined, eventName: string): PropertyItem[] {
  let position: PropertyItem[] = []
  if (fieldType == 'event_property') {
    position = eventPropertyMap.value.get(eventName) ?? []
    if (position.length > 0) {
      default_prototype = position[0] ?? null
    }
  } else {
    position = userProtoList.value
  }
  return position
}

/**
 * 过滤数据值联机选择器：默认聚合方式 + 该事件的属性（属性下挂各自的聚合方式）。
 * v2 是就地给 propertyList 里的属性对象挂 events 字段；这里改成生成一份副本，
 * 避免在 computed 里改源数据（联级选项的结构与结果完全一致）。
 */
const cascaderOptionsMap = computed(() => {
  const map = new Map<string, CascaderNode[]>()
  protoList.value.forEach((a) => {
    a.events.forEach((b) => {
      const merged: CascaderNode[] = [
        ...default_options.map((d) => ({ name: d.name, displayName: d.displayName })),
        ...b.propertyList.map((item) => {
          const node: CascaderNode = {
            name: item.name,
            displayName: item.displayName,
            dataType: item.dataType,
          }
          if (item.dataType) {
            switch (item.dataType) {
              case 'STRING':
                node.events = noNumber
                break
              case 'NUMBER':
                node.events = NumberType
                break
              default:
                node.events = noNumber
                break
            }
          }
          return node
        }),
      ]
      map.set(b.name, merged)
    })
  })
  return map
})

/** 空事件名（或事件不存在）时，与 v2 一致地只返回默认聚合方式 */
const defaultCascaderOptions = computed<CascaderNode[]>(() =>
  default_options.map((d) => ({ name: d.name, displayName: d.displayName })),
)

function formateCascader(val: string): CascaderNode[] {
  return cascaderOptionsMap.value.get(val) ?? defaultCascaderOptions.value
}

// el-cascader 的 options 形参是 CascaderOption[]（带索引签名），下面两个只做类型转换、
// 不复制对象，选项数组的引用保持稳定
const protoOptions = computed(() => protoList.value as unknown as CascaderOption[])
function casOptions(val: string) {
  return formateCascader(val) as unknown as CascaderOption[]
}

/** v2 的空实现，模板上 @change 绑了它 */
function changeRadio() {}

function deleteFirstCondition(filter: FilterModel, secondP_index: number, index: number) {
  filter.filters.splice(secondP_index, index)
  if (filter.filters.length < 2) {
    delete filter.relation
  }
}

/** 增加默认值（指标下的一级过滤条件） */
function firstLevelEvent(secondLevel: FilterModel, eventName: string) {
  const first = checkbtnPoint('event_property', eventName)[0]
  // v2 直接取 [0].dataType，属性列表为空时会抛错；模板上用 protoList.length > 0 挡了一层
  const dataType = first?.dataType || ''
  // 没有初始值则设置初始值
  if (!secondLevel.relation) {
    secondLevel.relation = 'and'
  }
  secondLevel.filters.push({
    conditions: [
      {
        field: strictMode(checkbtnPoint('event_property', eventName), 'name'),
        dataType: dataType,
        function: strictMode(filterCommonType(default_prototype?.dataType), 'name'),
        fieldType: 'event_property',
        params: [],
      },
    ],
  })
}

/**
 * 增加默认值（在已有分组里追加一个条件）。
 * v2 的形参是 (secondP_index, second_index, second_list, model)，其中 second_index 在函数体里
 * 从未被使用，迁移时去掉，调用处同步。
 */
function secondLevelEvent(secondP_index: number, second_list: FilterModel, model?: string) {
  let field: string | undefined = ''
  let dataType = ''
  if (model == 'gloab') {
    field = initSelectObj.value?.name
    dataType = initSelectObj.value?.dataType || ''
  } else {
    field = default_prototype?.name || ''
    dataType = default_prototype?.dataType || ''
  }
  const addObj: ConditionItem = {
    field: field,
    dataType: dataType,
    function: strictMode(filterCommonType(dataType), 'name'),
    fieldType: 'event_property',
    params: [],
  }
  second_list.filters.map((item, index) => {
    if (secondP_index == index) {
      item.relation = 'and'
      item.conditions.push(addObj)
    }
  })
}

/**
 * 平级事件。
 * 同 secondLevelEvent：v2 的 second_index 形参在函数体里没被用到，迁移时去掉。
 */
function equalityEvent(secondP_index: number, three_list: FilterModel, model?: string) {
  let field: string | undefined = ''
  let dataType = ''
  if (model == 'gloab') {
    field = initSelectObj.value?.name
    dataType = initSelectObj.value?.dataType || ''
  } else {
    field = default_prototype?.name || ''
    dataType = default_prototype?.dataType || ''
  }
  three_list.filters.map((item, index) => {
    if (index == secondP_index) {
      const threeObj: ConditionItem = {
        field: field,
        dataType: dataType,
        function: strictMode(filterCommonType(dataType), 'name'),
        fieldType: 'event_property',
        params: [],
      }
      item.conditions[item.conditions.length] = threeObj
    }
  })
}

/** 严格检验字段模式 */
function strictMode(
  val: { name: string; displayName: string }[] | PropertyItem[] | undefined,
  label: 'name' | 'displayName',
): string {
  if (val && val.length > 0) {
    return val[0]?.[label] ?? ''
  } else {
    return ''
  }
}

function getListEventPrototype(type: '用户' | '事件') {
  const latest = type === '用户' ? latestUserProp : latestEventProp
  const token = latest.next()
  const params = {
    projectName: modelObject.value.projectName,
    type: type,
  }
  getListNoGroupEventApi(params)
    .then((res) => {
      if (!latest.isLatest(token)) return
      if (res?.code == 200) {
        const list = (res.data as PropertyItem[]) || []
        if (type == '用户') {
          userProtoList.value = list
        } else {
          eventProtoList.value = list
          if (eventProtoList.value.length > 0) {
            initSelectObj.value = eventProtoList.value[0] ?? null
          } else {
            // 为空时清空历史值
            initSelectObj.value = null
          }
        }
      }
    })
    .catch(() => {
      /* 报错已由请求层统一提示 */
    })
}

function gloabDeleteEvent(secondP_index: number) {
  modelObject.value.filter.filters.splice(secondP_index, 1)
  if (modelObject.value.filter.filters.length < 2) {
    delete modelObject.value.filter.relation
  }
}

function gloabAddEvent() {
  modelObject.value.filter.filters.push({
    conditions: [
      {
        field: initSelectObj.value?.name,
        dataType: initSelectObj.value?.dataType,
        fieldType: 'event_property',
        function: strictMode(filterCommonType(initSelectObj.value?.dataType), 'name'),
        params: [],
      },
    ],
  })
  if (modelObject.value.filter.filters.length > 1) {
    modelObject.value.filter.relation = 'and'
  }
}

/** 新方式处理事件属性：下拉收起时把 fieldType 还原成展开那一刻的值 */
function handleVisibleChangeNew(event: boolean, secondP_item: FilterGroup, second_index: number) {
  // 处理测试不在当前值的大类中
  const cond = secondP_item.conditions[second_index]
  if (!cond) return
  if (event) {
    oldProperty = cond.fieldType
  } else {
    cond.fieldType = oldProperty
  }
}

/** 指标新处理方案 */
function handleVisibleChange(event: boolean, secondP_item: FilterGroup, second_index: number) {
  const cond = secondP_item.conditions[second_index]
  if (!cond) return
  if (event) {
    oldProperty = cond.fieldType
  } else {
    cond.fieldType = oldProperty
  }
}

/** 维度属性展开与显示 */
function checkDimensioFrom(
  type: FieldType | undefined,
  byFields: ModelObject['byFields'],
  index: number,
  x: PropertyItem,
) {
  const target = byFields[index]
  if (!target) return
  target.fieldType = type
  target.name = x.displayName
  target.dataType = x.dataType
  oldProperty = type
}

function handleVisibleDimension(
  event: boolean,
  type: FieldType | undefined,
  byFields: ModelObject['byFields'],
  index: number,
) {
  if (event) {
    oldProperty = type
  } else {
    const target = byFields[index]
    if (target) target.fieldType = oldProperty
  }
}
// end

/** 全局过滤属性展开与显示 */
function checkprototypeFromNew(
  item: PropertyItem,
  type: FieldType | undefined,
  secondP_item: FilterGroup,
  second_index: number,
) {
  const cond = secondP_item.conditions[second_index]
  if (!cond) return
  cond.fieldType = type
  cond.dataType = item.dataType
  const dataType = item.dataType || ''
  cond.function = strictMode(filterCommonType(dataType), 'name')
  // 保存change时的位置
  oldProperty = type
}

/** 指标属性操作事件 */
function checkpointProtoFrom(
  item: PropertyItem,
  type: FieldType | undefined,
  secondP_item: FilterGroup,
  second_index: number,
) {
  const dataType = item.dataType || ''
  const cond = secondP_item.conditions[second_index]
  if (!cond) return
  cond.fieldType = type
  cond.dataType = dataType
  cond.function = strictMode(filterCommonType(dataType), 'name')
  // 保存change时的位置
  oldProperty = type
}

function filterCommonType(type?: string): OptionDef[] {
  if (!type) return []
  return getOptionsByType(type)
}

function threeDeleteEvent(secondP_index: number, second_index: number, three_list: FilterGroup[]) {
  three_list[secondP_index]?.conditions.splice(second_index, 1)
}

function getLetterByIndex(index: number) {
  if (index < 0 || index >= 26) {
    return String.fromCharCode(65 + (index % 26))
  }
  return String.fromCharCode(65 + index) // 65 是大写字母 A 的 ASCII 编码
}

function getLetterLowercase(index: number) {
  if (index < 0 || index >= 26) {
    return String.fromCharCode(97 + (index % 26))
  }
  return String.fromCharCode(97 + index)
}

/** 事件名称 */
function getPrototype() {
  const token = latestProto.next()
  getGroupedPropertiesApi({
    projectName: modelObject.value.projectName,
  })
    .then((res) => {
      if (!latestProto.isLatest(token)) return
      if (res?.code == 200) {
        if (res.data) {
          const mergedData = mergeCommonPropertiesToEvents(
            res.data as Parameters<typeof mergeCommonPropertiesToEvents>[0],
          )
          protoList.value = (mergedData && mergedData.events) || []
          protoList.value.map((item, index) => {
            item.events.map((sub, sub_index) => {
              if (sub_index == 0 && index == 0) {
                eventType = sub.name
              }
            })
          })
          const firstEvent = protoList.value[0]?.events[0]
          if (!firstEvent) return
          // 设置初始值
          pointerDefaultMeasureName =
            firstEvent.displayName + '的' + (defaultType[0]?.displayName ?? '')
          // 设置默认初始值
          if (modelObject.value.measures.length < 2) {
            const measure = modelObject.value.measures[0]
            if (measure && !measure.eventName && protoList.value.length > 0 && firstEvent.name) {
              measure.eventName = firstEvent.name
              if (measure.casList.length < 1) {
                measure.aggregator = pointerDefaultOne
                measure.casList = [pointerDefaultOne]
              }
              pointerDefaultMeasureName =
                firstEvent.displayName + '的' + (defaultType[0]?.displayName ?? '')
              measure.name = pointerDefaultMeasureName
              measure.defaultMeasureName = pointerDefaultMeasureName
            }
          }
        }
      }
    })
    .catch(() => {
      /* 报错已由请求层统一提示 */
    })
}

// ===== watch =====
watch(projectName, (val) => {
  const modelObject_refresh = createEmptyModel(false)
  if (route.query.query) {
    const queryObj = JSON.parse(route.query.query as string) as ModelObject
    let tagObj: Partial<BookmarkTag> = {}
    if (route.query.tagObj) {
      tagObj = JSON.parse(route.query.tagObj as string) as BookmarkTag
    }
    if (val == queryObj.projectName) {
      modelObject.value = queryObj
      if (tagObj.bookmarkId) {
        handleUpdate(tagObj as BookmarkTag)
      }
    } else {
      // 缓存路由项目
      modelObject.value = modelObject_refresh
    }
    emit('customLoading', 'clearnData')
    modelObject.value.startDate = queryObj.startDate
    modelObject.value.endDate = queryObj.endDate
    modelObject.value.dataType = queryObj.dataType
    modelObject.value.timeFlag = queryObj.timeFlag
  } else {
    modelObject.value = modelObject_refresh
    modelObject.value.timeFlag = commonParams.value.timeFlag
  }
  commonParams.value.projectName = val
  modelObject.value.projectName = val
  getPrototype() // 获取联级指标
  getListEventPrototype('用户') // 获取指标属性
  getListEventPrototype('事件') // 获取指标属性
  getCommonPropertyList() // 维度、全局 属性可选择数据
})

watch(
  modelObject,
  (newVal) => {
    if (!route.query.query && initSumApi > 2) {
      void router.replace({
        path: CUSTOM_ANALYSIS_PATH,
        query: {
          query: JSON.stringify(copyObj(newVal)),
        },
      })
    }
    if (route.query.query && !route.query.tagObj && initSumApi > 2) {
      void router.replace({
        path: CUSTOM_ANALYSIS_PATH,
        query: {
          query: JSON.stringify(copyObj(newVal)),
        },
      })
    }
    // 存在query的情况
    if (route.query.query && route.query.tagObj && initSumApi > 2) {
      void router.replace({
        path: CUSTOM_ANALYSIS_PATH,
        query: {
          query: JSON.stringify(newVal),
          tagObj: route.query.tagObj,
        },
      })
    }
    // 滚动条跳转
    scrollToPosition()
    initSumApi++
  },
  { deep: true }, // 深度监听
)

onMounted(() => {
  window.addEventListener('scroll', updateScrollPosition)
  if (route.query.query) {
    modelObject.value = JSON.parse(route.query.query as string) as ModelObject
    bus.emit('$CHECKPROJECT', modelObject.value.projectName)
    void nextTick(() => {
      bus.emit('$refreshRoute')
    })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateScrollPosition)
})

defineExpose({ addTagEvent, startAnalysis, customInitEvent })
</script>

<style lang="scss">
.headTitle {
  width: 80px;
  line-height: 30px;
}

// 匹配不到样式隐藏
// v2 写的是 .el-select-dropdown__empty { display: none !important }。
// Element UI 里自定义 empty 插槽会「替换」掉那个 <p class="el-select-dropdown__empty">，
// 所以这条规则只隐藏默认的「无数据」文案；element-plus 改成把插槽渲染在
// .el-select-dropdown__empty 内部，原样照抄会连本组件的「事件属性/用户属性 + 暂无数据」
// 一起隐藏。这里改成只隐藏默认文案那个 <span>（有自定义插槽时根本不会渲染它），
// 语义与 v2 完全相同。
.el-select-dropdown__empty > span {
  display: none !important;
}
</style>

<style lang="scss" scoped>
// 单独设置编辑自定义名称事件
.custom_input :deep(.el-input__wrapper) {
  height: 27px;
}

// v2 用的是 .el-icon-edit（Element UI 的字体图标类名），
// element-plus 换成了组件，这里改用自定义类 .edit-icon，规则本身不变
.edit-icon {
  display: none;
}

.childRows:hover {
  background: #f4f4f4;
}

.childRows:hover .edit-icon {
  display: block;
}

// end
p {
  white-space: nowrap;
  padding: 0;
  margin: 0;
}

.titleHead {
  color: #6d6e70;
  font-size: 13px;
}

:deep(.el-loading-spinner .circular) {
  height: 30px !important;
  margin-top: 5px;
}

:deep(.el-input__inner::placeholder) {
  font-size: 11px;
}

:deep(.el-input-number.is-controls-right [class*='increase']),
:deep(.el-input-number.is-controls-right [class*='decrease']) {
  line-height: 12px;
  margin-top: 3px;
}

:deep(.custom_btn .el-radio-button__original-radio:checked + .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.custom_btn .el-radio-button:last-child .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.el-radio-button .el-radio-button__inner) {
  font-size: 10px !important;
}

:deep(.el-select .el-input .el-select__caret) {
  line-height: 30px;
}

:deep(.el-select-dropdown__list) {
  padding: 0 0 6px;
}

:deep(.el-radio-group) {
  margin: 0 5px;
}

:deep(.el-radio-button__inner) {
  border-left: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 6px;
  font-size: 13px;
}

:deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: 4px;
}

:deep(.el-radio-button) {
  height: 20px;
  font-size: 12px;
}

:deep(.el-input__wrapper) {
  height: 30px;
  line-height: 30px;
}

:deep(.el-input__inner) {
  font-size: 12px;
}

:deep(.el-cascader .el-input .el-input__inner) {
  font-size: 12px;
}

:deep(.custom_btn) {
  padding: 1px 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  .el-radio-button:first-child .el-radio-button__inner {
    border-radius: 4px 4px 0 0;
  }

  .el-radio-button:last-child .el-radio-button__inner {
    border-radius: 0 0 4px 4px;
  }

  .el-radio-button--small .el-radio-button__inner {
    padding: 5px;
  }

  .el-radio-button__original-radio:checked + .el-radio-button__inner {
    color: #ffffff;
    background-color: #619ff3;
    border-color: #619ff3;
    -webkit-box-shadow: -1px 0 0 0 #619ff3;
    box-shadow: -1px 0 0 0 #619ff3;
  }
}

.letter_lower {
  font-size: 14px;
  line-height: 30px;
}

.btn_line {
  width: 1px;
  height: 100%;
  border-right: 1px solid rgb(218, 217, 217);
}

.empty-text {
  display: flex;
  text-align: center;
  color: #909399;
  padding: 10px 0;
  margin-bottom: 10px;
}

.select_empty {
  text-align: center;
  margin-bottom: 10px;
  font-size: 12px;
  color: #909399;
}

.box-card {
  // 指标间距
  .pointer_spacing {
    margin-left: 80px;
  }

  // v2 是 .el-icon-plus（Element UI 字体图标类），element-plus 下换成 .add-filter-btn
  .add-filter-btn {
    color: #2c7be5;
    font-size: 13px;
    margin-top: 3px;
    padding-left: 0px;
    box-sizing: border-box;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
  }

  .eg_letters {
    color: rgb(101, 100, 100);
    width: 30px;
    height: 30px;
    font-size: 14px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: 400;
    margin-right: 10px;
  }

  .default_font {
    color: #fff;
    font-size: 14px;
  }

  .delete_btn:hover {
    color: #2c7be5;
  }

  .add_icon {
    cursor: pointer;
    font-size: 30px;
    font-weight: 400;
    margin-top: 15px;
    color: rgb(225, 225, 225);
  }

  .delete_btn {
    cursor: pointer;
    font-size: 16px;
    margin: 0 8px;
    line-height: 30px;
    color: rgb(188, 188, 188);
  }

  .circle {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: #fff;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 20px;
    font-weight: 400;
    border: 1px solid #2c7be5;
    color: #2c7be5;
    cursor: pointer;
  }

  .circle::after {
    content: '+';
  }
}
</style>
