'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Client = {
  id: string
  name: string
  city: string | null
  state: string | null
  contact: string | null
  phone: string | null
  email: string | null
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [contact, setContact] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  async function loadClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert('Erro ao carregar clientes: ' + error.message)
      console.error(error)
      return
    }

    setClients(data || [])
  }

  async function createClient() {
    if (!name.trim()) {
      alert('Informe o nome do cliente')
      return
    }

    const { error } = await supabase.from('clients').insert({
      name,
      city,
      state,
      contact,
      phone,
      email,
    })

    if (error) {
      alert('Erro ao salvar cliente: ' + error.message)
      console.error(error)
      return
    }

    setName('')
    setCity('')
    setState('')
    setContact('')
    setPhone('')
    setEmail('')

    loadClients()
  }

  useEffect(() => {
    loadClients()
  }, [])

  return (
    <main className="min-h-screen bg-transparent p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">
          Clientes
        </h1>

        <div className="mb-8 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Cadastrar cliente</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <input className="rounded border p-2" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="rounded border p-2" placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
            <input className="rounded border p-2" placeholder="Estado" value={state} onChange={(e) => setState(e.target.value)} />
            <input className="rounded border p-2" placeholder="Contato" value={contact} onChange={(e) => setContact(e.target.value)} />
            <input className="rounded border p-2" placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="rounded border p-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <button
            onClick={createClient}
            className="mt-4 rounded bg-[#0B3D2E] px-5 py-2 font-semibold text-white hover:bg-green-800"
          >
            Salvar cliente
          </button>
        </div>

        <div className="rounded-2xl border border-[#DDE7E1] bg-white/90 p-6 shadow-sm backdrop-blur">
          <h2 className="mb-4 text-xl font-semibold">Clientes cadastrados</h2>

          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b">
                <th className="p-2">Nome</th>
                <th className="p-2">Cidade</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Contato</th>
                <th className="p-2">Telefone</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b">
                  <td className="p-2">{client.name}</td>
                  <td className="p-2">{client.city}</td>
                  <td className="p-2">{client.state}</td>
                  <td className="p-2">{client.contact}</td>
                  <td className="p-2">{client.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}