import { useState, useEffect, useRef } from 'react'
import {
  collection, doc, query, onSnapshot,
  addDoc, setDoc, updateDoc, deleteDoc, getDocs,
  serverTimestamp, getDoc,
} from 'firebase/firestore'
import { db } from '@/firebase/config'

export function useCollection(collectionName, constraints = [], key = '') {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const keyRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    let unsub = () => {}

    // Timeout 10s để tránh spinner vô tận khi Firestore chưa được kích hoạt
    const timeout = setTimeout(() => {
      setLoading(false)
      setError(new Error('Không thể kết nối Firestore. Kiểm tra Firebase Console → Firestore Database đã được tạo chưa.'))
    }, 10000)

    try {
      const ref = collection(db, collectionName)
      const q = constraints.length ? query(ref, ...constraints) : query(ref)

      unsub = onSnapshot(
        q,
        snap => {
          clearTimeout(timeout)
          setData(snap.docs.map(d => ({ id: d.id, ...d.data() })))
          setLoading(false)
          setError(null)
        },
        err => {
          clearTimeout(timeout)
          console.error(`Firestore [${collectionName}]:`, err.message)
          setError(err)
          setLoading(false)
        }
      )
    } catch (err) {
      clearTimeout(timeout)
      setError(err)
      setLoading(false)
    }

    return () => { clearTimeout(timeout); unsub() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, JSON.stringify(constraints.map(c => String(c))), key])

  return { data, loading, error }
}

export function useDocument(collectionName, docId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!docId) { setLoading(false); return }

    const timeout = setTimeout(() => {
      setLoading(false)
      setError(new Error('Timeout kết nối Firestore'))
    }, 10000)

    const ref = doc(db, collectionName, docId)
    const unsub = onSnapshot(
      ref,
      snap => {
        clearTimeout(timeout)
        setData(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        setLoading(false)
      },
      err => {
        clearTimeout(timeout)
        setError(err)
        setLoading(false)
      }
    )
    return () => { clearTimeout(timeout); unsub() }
  }, [collectionName, docId])

  return { data, loading, error }
}

// Wrapper với timeout 15s để tránh hang vô tận
async function withTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout — kiểm tra Firestore đã được kích hoạt chưa')), ms)
    ),
  ])
}

export async function addDocument(collectionName, data) {
  const ref = collection(db, collectionName)
  return withTimeout(addDoc(ref, { ...data, created_at: serverTimestamp() }))
}

export async function setDocument(collectionName, docId, data) {
  const ref = doc(db, collectionName, docId)
  return withTimeout(setDoc(ref, { ...data, created_at: serverTimestamp() }))
}

export async function updateDocument(collectionName, docId, data) {
  const ref = doc(db, collectionName, docId)
  return withTimeout(updateDoc(ref, { ...data, updated_at: serverTimestamp() }))
}

export async function deleteDocument(collectionName, docId) {
  const ref = doc(db, collectionName, docId)
  return withTimeout(deleteDoc(ref))
}

export async function getDocumentOnce(collectionName, docId) {
  const ref = doc(db, collectionName, docId)
  const snap = await withTimeout(getDoc(ref))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function queryOnce(collectionName, constraints = []) {
  const ref = collection(db, collectionName)
  const q = constraints.length ? query(ref, ...constraints) : query(ref)
  const snap = await withTimeout(getDocs(q))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
