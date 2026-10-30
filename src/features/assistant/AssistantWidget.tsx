import { AnimatePresence, motion } from 'framer-motion'
import { LuArrowRight as ArrowRight, LuMessageCircleQuestion as MessageCircleQuestion, LuSendHorizontal as SendHorizontal, LuSparkles as Sparkles, LuX as X } from 'react-icons/lu'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth, useCan } from '@/stores/auth'
import { useInventory } from '@/stores/inventory'
import { useSales } from '@/stores/sales'
import { intentsFor, matchIntent, type Answer } from './intents'

interface Msg {
  id: number
  from: 'user' | 'bot'
  text: string
  answer?: Answer
}

let seq = 0

/** Botón flotante + panel de preguntas. Responde con los datos de la tienda, en el momento. */
export function AssistantWidget() {
  const role = useAuth((s) => s.user?.role)
  const name = useAuth((s) => s.user?.name.split(' ')[0])
  const canSales = useCan('ventas.ver')
  const loadSales = useSales((s) => s.load)
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [thinking, setThinking] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const questions = intentsFor(role)

  useEffect(() => {
    if (open && canSales) void loadSales()
  }, [open, canSales, loadSales])

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs, thinking])

  const ask = async (question: string) => {
    const q = question.trim()
    if (!q || thinking) return
    setText('')
    setMsgs((m) => [...m, { id: ++seq, from: 'user', text: q }])
    setThinking(true)
    const intent = questions.find((i) => i.question === q) ?? matchIntent(q, role)
    // Pausa breve para que se lea como respuesta y no como un salto de pantalla.
    await new Promise((r) => setTimeout(r, 450))
    let answer: Answer
    try {
      const { products, seasons, settings } = useInventory.getState()
      answer = intent
        ? await intent.answer({ products, seasons, settings, sales: useSales.getState().sales })
        : { text: 'Todavía no sé responder eso. Prueba con alguna de estas preguntas:' }
    } catch (e) {
      answer = { text: e instanceof Error ? e.message : 'No pude calcular la respuesta.' }
    }
    setThinking(false)
    setMsgs((m) => [...m, { id: ++seq, from: 'bot', text: answer.text, answer: intent ? answer : { ...answer, items: questions.slice(0, 4).map((i) => ({ label: i.question, value: '' })) } }])
  }

  const goProduct = (id?: string) => {
    if (!id) return
    setOpen(false)
    navigate(`/?producto=${id}`)
  }

  return (
    <>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.06, rotate: -4 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-24 right-4 z-40 grid size-14 place-items-center rounded-full bg-ink text-sol shadow-lift lg:bottom-6 lg:right-6"
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente'}
        aria-expanded={open}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={open ? 'x' : 'q'} initial={{ rotate: -90, scale: 0.5 }} animate={{ rotate: 0, scale: 1 }} exit={{ rotate: 90, scale: 0.5 }}>
            {open ? <X className="size-6" /> : <MessageCircleQuestion className="size-7" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.section
            aria-label="Asistente"
            initial={{ opacity: 0, y: 24, scale: 0.95, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed bottom-40 right-4 z-40 flex max-h-[min(36rem,calc(100dvh-12rem))] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl bg-surface shadow-lift ring-1 ring-line lg:bottom-24 lg:right-6"
          >
            <header className="flex items-center gap-3 bg-rail px-5 py-4 text-white">
              <span className="grid size-9 place-items-center rounded-xl bg-sol text-on-fill">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-black">Asistente DragoToY</p>
                <p className="text-xs font-semibold text-rail-ink">Responde con los datos de la tienda, al instante.</p>
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {msgs.length === 0 && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-bold">Hola{name ? `, ${name}` : ''}. ¿Qué quieres saber?</p>
                  <div className="flex flex-col gap-2">
                    {questions.map((q, i) => (
                      <motion.button
                        key={q.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => void ask(q.question)}
                        className="flex items-center justify-between gap-2 rounded-2xl bg-sunken px-4 py-2.5 text-left text-sm font-extrabold transition-colors hover:bg-sol-wash"
                      >
                        {q.question}
                        <ArrowRight className="size-4 shrink-0 text-ink-soft" aria-hidden />
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
              {msgs.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={clsx('flex', m.from === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div className={clsx('max-w-[88%] rounded-2xl px-4 py-2.5 text-sm', m.from === 'user' ? 'rounded-br-md bg-ink font-bold text-ground' : 'rounded-bl-md bg-sunken font-semibold')}>
                    <p>{m.text}</p>
                    {m.answer?.items && m.answer.items.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1">
                        {m.answer.items.map((it, i) => (
                          <li key={i}>
                            <button
                              onClick={() => (it.productId ? goProduct(it.productId) : !it.value && void ask(it.label))}
                              className={clsx(
                                'flex w-full items-center justify-between gap-3 rounded-lg bg-surface px-3 py-1.5 text-left text-xs',
                                (it.productId || !it.value) && 'hover:ring-2 hover:ring-sol',
                              )}
                            >
                              <span className="min-w-0 truncate font-extrabold">{it.label}</span>
                              {it.value && <span className="num shrink-0 font-bold text-ink-soft">{it.value}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {m.answer?.link && (
                      <button
                        onClick={() => (setOpen(false), navigate(m.answer!.link!.to))}
                        className="mt-2 flex items-center gap-1 text-xs font-extrabold text-turquesa-ink underline underline-offset-2"
                      >
                        {m.answer.link.label} <ArrowRight className="size-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
              {thinking && (
                <div className="flex gap-1 rounded-2xl bg-sunken px-4 py-3" aria-label="Pensando" style={{ width: 'fit-content' }}>
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="size-2 rounded-full bg-ink-soft" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }} />
                  ))}
                </div>
              )}
              <div ref={end} />
            </div>

            {msgs.length > 0 && (
              <div className="flex gap-2 overflow-x-auto border-t-2 border-line px-3 py-2">
                {questions.slice(0, 6).map((q) => (
                  <button key={q.id} onClick={() => void ask(q.question)} className="shrink-0 rounded-full bg-sunken px-3 py-1.5 text-xs font-extrabold hover:bg-sol-wash">
                    {q.question}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={(e) => (e.preventDefault(), void ask(text))} className="flex gap-2 border-t-2 border-line p-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escribe tu pregunta…"
                className="h-11 min-w-0 flex-1 rounded-xl border-2 border-line bg-ground px-3 text-sm font-bold placeholder:font-semibold placeholder:text-ink-soft/80 focus:border-turquesa focus:shadow-focus focus:outline-none"
              />
              <button type="submit" disabled={!text.trim() || thinking} className="grid size-11 place-items-center rounded-xl bg-ink text-ground disabled:opacity-40" aria-label="Enviar">
                <SendHorizontal className="size-5" />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  )
}
