'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type BiomassType = {
  id: string
  name: string
  description: string | null
}

export default function TiposBiomassaPage() {
  const [types, setTypes] = useState<BiomassType[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  async function loadTypes() {
    const { data, error } = await supabase
      .from('biomass_types')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert('Erro ao carregar tipos: ' + error.message)
      return
    }

    setTypes(data || [])
  }

  async function createType() {
    if (!name.trim()) {
      alert('Informe o nome do tipo de biomassa')
      return
    }

    const { error } = await supabase.from('biomass_types').insert({
      name,
      description,
    })

    if (error) {
      alert('Erro ao salvar tipo: ' + error.message)
      return
    }

    setName('')
    setDescription('')
    loadTypes()
  }

  useEffect(() => {
    loadTypes()
  }, [])

  return (
    <main className="min-h-screen bg-transparent p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">
          Tipos de Biomassa
        </h1>

        <div className="mb-8 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Cadastrar tipo</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              className="rounded border p-2"
              placeholder="Ex: cavaco de eucalipto"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              className="rounded border p-2"
              placeholder="Descrição"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <button
            onClick={createType}
            className="mt-4 rounded bg-[#0B3D2E] px-5 py-2 font-semibold text-white hover:bg-green-800"
          >
            Salvar tipo
          </button>
        </div>

        <div className="rounded-2xl border border-[#DDE7E1] bg-white/90 p-6 shadow-sm backdrop-blur">
          <h2 className="mb-4 text-xl font-semibold">Tipos cadastrados</h2>

          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b">
                <th className="p-2">Nome</th>
                <th className="p-2">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.id} className="border-b">
                  <td className="p-2">{type.name}</td>
                  <td className="p-2">{type.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}