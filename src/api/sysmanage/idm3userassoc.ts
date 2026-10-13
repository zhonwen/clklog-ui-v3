import request from '@/utils/requestManage'

export interface IdentityTypeItem {
  identityType?: string
  typeName?: string
  category?: string
  description?: string
  isSystem?: boolean
  createTime?: string
  updateTime?: string
}

export interface ProjectConfig {
  idmVersion?: string
  enableIdentityBind?: boolean
  enableIdentityUnbind?: boolean
  mergeBackfillWindowDays?: number
  mergeStrategy?: string
  enableCache?: boolean
  cacheTtlMinutes?: number
  cacheMaxSize?: number
  status?: number
}

export interface IdentityConstraintItem {
  id?: string
  identityType?: string
  constraintType?: string
  maxCount?: number
  overflowStrategy?: string
  priority?: number
  enableBind?: boolean
  enableUnbind?: boolean
  status?: number
  createTime?: string
  updateTime?: string
}

export interface MergeRecordItem {
  mergeId?: string
  projectName?: string
  userIdKeep?: string
  userIdMerge?: string
  mergeReason?: string
  status?: string
  costMs?: number
  plannedMergeTime?: string
  operator?: string
  createTime?: string
  errorMsg?: string
  remark?: string
  identityDetails?: MergeDetailItem[]
  anoDetails?: MergeDetailItem[]
  loginDetails?: MergeDetailItem[]
  transitiveDetails?: MergeDetailItem[]
}

export interface MergeDetailItem {
  identityType?: string
  oldUserId?: string
  newUserId?: string
  action?: string
  skipReason?: string
}

export interface MergeStats {
  failRate?: number | null
  statusStats?: Record<string, number>
  reasonStats?: Record<string, number>
  timeStats?: Record<string, number>
}

export interface MergeChainItem {
  mergeId?: string
  projectName?: string
  userIdKeep?: string
  userIdMerge?: string
  mergeReason?: string
  status?: string
}

export interface MergeChainResult {
  finalUser?: string
  chain?: MergeChainItem[]
}

export interface PageMergeResult {
  list?: MergeRecordItem[]
  total?: number
}

export function getProjectConfig(params: { projectName?: string }) {
  return request<ProjectConfig>({
    url: '/userassoc/config/project/get',
    method: 'post',
    data: params,
  })
}

export function saveProjectConfig(params: Record<string, unknown>) {
  return request({
    url: '/userassoc/config/project/save',
    method: 'post',
    data: params,
  })
}

export function listIdentityConstraint(params: { projectName?: string }) {
  return request<IdentityConstraintItem[]>({
    url: '/userassoc/config/identity/list',
    method: 'post',
    data: params,
  })
}

export function saveIdentityConstraint(params: Record<string, unknown>) {
  return request({
    url: '/userassoc/config/identity/save',
    method: 'post',
    data: params,
  })
}

export function deleteIdentityConstraint(params: { projectName?: string; identityType?: string }) {
  return request({
    url: '/userassoc/config/identity/delete',
    method: 'post',
    data: params,
  })
}

export function listIdentityType(params: Record<string, unknown> = {}) {
  return request<IdentityTypeItem[]>({
    url: '/userassoc/config/identityType/list',
    method: 'post',
    data: params,
  })
}

export function saveIdentityType(params: Record<string, unknown>) {
  return request({
    url: '/userassoc/config/identityType/save',
    method: 'post',
    data: params,
  })
}

export function deleteIdentityType(params: { identityType?: string }) {
  return request({
    url: '/userassoc/config/identityType/delete',
    method: 'post',
    data: params,
  })
}

export function reloadConfig(params: Record<string, unknown> = {}) {
  return request({
    url: '/userassoc/config/reload',
    method: 'post',
    data: params,
  })
}

export function pageMerge(params: Record<string, unknown>) {
  return request<PageMergeResult>({
    url: '/userassoc/merge/page',
    method: 'post',
    data: params,
  })
}

export function mergeDetail(params: { mergeId?: string }) {
  return request<MergeRecordItem>({
    url: '/userassoc/merge/detail',
    method: 'post',
    data: params,
  })
}

export function mergeStats(params: Record<string, unknown>) {
  return request<MergeStats>({
    url: '/userassoc/merge/stats',
    method: 'post',
    data: params,
  })
}

export function manualMerge(params: Record<string, unknown>) {
  return request<{ mergeId?: string; status?: string; costMs?: number }>({
    url: '/userassoc/merge/manual',
    method: 'post',
    data: params,
  })
}

export function mergeChain(params: { userId?: string }) {
  return request<MergeChainResult>({
    url: '/userassoc/merge/chain',
    method: 'post',
    data: params,
  })
}
