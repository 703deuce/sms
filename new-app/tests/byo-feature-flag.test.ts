import {afterEach,describe,expect,it,vi} from 'vitest'
describe('V1 BYO launch isolation',()=>{
  afterEach(()=>{
    delete process.env.FEATURE_BYO_V1
    vi.resetModules()
  })
  it('is disabled by default (B0)',async()=>{
    delete process.env.FEATURE_BYO_V1
    const {isByoFeatureEnabled}=await import('@/lib/server/clips/feature-gates')
    expect(isByoFeatureEnabled()).toBe(false)
  })
  it('only enables on explicit flag',async()=>{
    process.env.FEATURE_BYO_V1='1'
    const {isByoFeatureEnabled}=await import('@/lib/server/clips/feature-gates')
    expect(isByoFeatureEnabled()).toBe(true)
  })
})
