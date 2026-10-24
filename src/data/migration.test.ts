import { describe, expect, it } from 'vitest'
import { splitLegacyConfigs } from './db'

describe('migração v4: regra única → empresa + carteira', () => {
  it('separa partes de pessoas (empresa) dos destinos de investimento (carteira)', () => {
    const out = splitLegacyConfigs([
      {
        id: 'old',
        effectiveFrom: '2026-01',
        createdAt: 1,
        buckets: [
          { key: 'investimentos', name: 'Investimentos', color: '#000', bps: 3000, role: 'investimentos' },
          { key: 'projetos', name: 'Projetos futuros', color: '#000', bps: 4000, role: 'projetos' },
          { key: 'minha-parte', name: 'Minha parte', color: '#000', bps: 1500, role: 'retirada' },
          { key: 'socio-x', name: 'Sócio', color: '#000', bps: 1500, role: 'retirada', partnerId: 'x' },
        ],
      },
    ])
    const empresa = out.filter((c) => c.scope === 'empresa')
    const pessoal = out.filter((c) => c.scope === 'pessoal')
    expect(empresa).toHaveLength(1)
    expect(pessoal).toHaveLength(1)
    // 15% você + 15% sócio + 70% fica na empresa
    expect(empresa[0].buckets.map((b) => [b.role, b.bps])).toEqual([['retirada', 1500], ['retirada', 1500], ['caixa', 7000]])
    // 30/40 reescalado para 100%: 42,86% / 57,14%
    expect(pessoal[0].buckets.map((b) => b.bps)).toEqual([4286, 5714])
    expect(pessoal[0].effectiveFrom).toBe('2026-01')
  })

  it('sem partes de pessoas, cria a divisão padrão (100% seu)', () => {
    const out = splitLegacyConfigs([
      { id: 'a', effectiveFrom: '2025-10', createdAt: 1, buckets: [{ key: 'i', name: 'Investimentos', color: '#000', bps: 10000, role: 'investimentos' }] },
    ])
    const empresa = out.find((c) => c.scope === 'empresa')!
    expect(empresa.effectiveFrom).toBe('2025-10')
    expect(empresa.buckets).toEqual([expect.objectContaining({ role: 'retirada', bps: 10000 })])
  })

  it('regras já migradas passam intactas', () => {
    const cfg = { id: 'e', scope: 'empresa' as const, effectiveFrom: '2026-01', createdAt: 1, buckets: [] }
    const out = splitLegacyConfigs([cfg, { ...cfg, id: 'p', scope: 'pessoal' as const }])
    expect(out.map((c) => c.id)).toEqual(['e', 'p'])
  })
})
