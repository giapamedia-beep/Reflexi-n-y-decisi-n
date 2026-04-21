import { useEffect, useState, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PlusCircle, 
  History, 
  BrainCircuit, 
  LogOut, 
  ChevronRight, 
  Target, 
  Scale, 
  Grid3X3, 
  Trash2,
  AlertCircle,
  CheckCircle2,
  Info,
  ArrowLeft
} from 'lucide-react';
import { auth, db, googleProvider } from './lib/firebase';
import { 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc
} from 'firebase/firestore';
import { analyzeDecision, AnalysisType } from './services/gemini';

// --- Types ---
interface Decision {
  id: string;
  title: string;
  description: string;
  type: AnalysisType;
  analysis: any;
  createdAt: any;
  notes?: string;
}

// --- Components ---

const Button = ({ onClick, children, variant = 'primary', className = '', disabled = false, loading = false }: any) => {
  const base = "px-6 py-3 rounded-none font-sans uppercase tracking-[0.2em] text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95";
  const variants: any = {
    primary: "bg-navy text-white shadow-[4px_4px_0px_0px_rgba(212,138,62,0.4)] hover:translate-y-[-2px]",
    secondary: "bg-ochre text-white shadow-[4px_4px_0px_0px_rgba(22,42,68,0.2)] hover:translate-y-[-2px]",
    danger: "bg-clay text-white shadow-[4px_4px_0px_0px_rgba(22,42,68,0.1)] hover:bg-clay/90",
    ghost: "bg-transparent text-navy hover:bg-sand-dark"
  };
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" /> : children}
    </button>
  );
};

const Card = ({ children, className = "", rotation = 0, withTape = false, tapeColor = "#d48a3e", onClick }: any) => (
  <div 
    onClick={onClick}
    className={`scrapbook-card p-8 group ${className} ${onClick ? 'cursor-pointer' : ''}`}
    style={{ transform: `rotate(${rotation}deg)` } as any}
  >
    {withTape && (
      <div 
        className="washi-tape" 
        style={{ '--tape-color': tapeColor, '--tape-rotate': `${(rotation * -1) + (Math.random() * 4 - 2)}deg` } as any} 
      />
    )}
    {children}
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [view, setView] = useState<'home' | 'new' | 'result' | 'history'>('home');
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  
  // New Decision Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [analysisType, setAnalysisType] = useState<AnalysisType>('pros_cons');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'decisions'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Decision[];
      setDecisions(docs);
    });

    return unsubscribe;
  }, [user]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === 'auth/popup-blocked') {
        alert("¡Ventana emergente bloqueada!\n\nDebido a las restricciones del navegador en este entorno de previsualización, debes abrir la aplicación en una pestaña nueva para iniciar sesión con éxito.\n\nHaz clic en el icono de 'Abrir en una pestaña nueva' (el cuadrado con flecha en la esquina superior derecha) e intenta de nuevo.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        console.warn("Múltiples intentos de login detectados.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        alert("Iniciio de sesión cancelado. Si tienes problemas con la ventana emergente, prueba abrir la aplicación en una pestaña nueva.");
      } else {
        alert(`Error al iniciar sesión: ${error.message}. Te recomendamos abrir la aplicación en una pestaña nueva.`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleCreateDecision = async (
    targetTitle?: string, 
    targetDesc?: string, 
    targetType?: AnalysisType
  ) => {
    const activeTitle = targetTitle || title;
    const activeDesc = targetDesc || description;
    const activeType = targetType || analysisType;

    if (!user || !activeTitle || !activeDesc) return;
    
    setIsAnalyzing(true);
    try {
      const analysisResult = await analyzeDecision(activeDesc, activeType);
      
      const docData: any = {
        userId: user.uid,
        title: activeTitle,
        description: activeDesc,
        type: activeType,
        analysis: analysisResult,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        notes: ""
      };

      const docRef = await addDoc(collection(db, 'decisions'), docData);

      const newDecision: Decision = {
        id: docRef.id,
        title: activeTitle,
        description: activeDesc,
        type: activeType,
        analysis: analysisResult,
        createdAt: new Date(),
        notes: ""
      };

      setSelectedDecision(newDecision);
      setView('result');
      if (!targetTitle) setTitle('');
      if (!targetDesc) setDescription('');
    } catch (error) {
      console.error("Analysis Error:", error);
      alert("Error al analizar la decisión. Inténtalo de nuevo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateNotes = async (id: string, notes: string) => {
    try {
      await updateDoc(doc(db, 'decisions', id), {
        notes,
        updatedAt: serverTimestamp()
      });
      // Force update the global decisions state to ensure history reflects changes
      setDecisions(prev => prev.map(d => d.id === id ? { ...d, notes } : d));
      
      if (selectedDecision?.id === id) {
        setSelectedDecision({ ...selectedDecision, notes });
      }
    } catch (error) {
      console.error("Update Notes Error:", error);
    }
  };

  const handleDeleteDecision = async (id: string, e: MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Estás seguro de que quieres eliminar este análisis?")) return;
    try {
      await deleteDoc(doc(db, 'decisions', id));
      if (selectedDecision?.id === id) setView('home');
    } catch (error) {
      console.error("Delete Error:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfdfd]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-black border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-sand flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl"
        >
          <div className="mb-12 flex justify-center">
            <div className="w-24 h-24 bg-navy rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(22,42,68,0.2)] border-2 border-ochre/50 relative overflow-hidden group">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_40%,_rgba(212,138,62,0.1)_100%)]" />
              <span className="font-serif text-3xl text-ochre italic font-bold z-10">SB</span>
              <div className="absolute top-1 left-1 right-1 bottom-1 border border-ochre/20 rounded-full opacity-30" />
            </div>
          </div>
          <h1 className="text-5xl font-serif text-navy mb-4 tracking-tight leading-tight">
            TOMA DE <span className="italic font-light text-ochre">DECISIONES</span>
          </h1>
          <p className="text-sm font-sans uppercase tracking-[0.5em] text-clay mb-12">
            EL DESEMPATE
          </p>
          <p className="text-2xl font-writing text-clay mb-12 leading-relaxed max-w-md mx-auto">
            "Tu diario consciente para transformar la información en claridad absoluta."
          </p>
          <Button 
            onClick={handleLogin} 
            className="mx-auto px-12 py-5 text-base"
            loading={isLoggingIn}
          >
            EMPEZAR EL DIARIO
            <ChevronRight size={20} />
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand text-navy font-sans">
      <nav className="max-w-6xl mx-auto px-6 py-10 flex justify-between items-center">
        <button onClick={() => setView('home')} className="flex flex-col items-start hover:opacity-70 transition-opacity">
          <div className="flex items-center gap-2">
            <span className="font-serif text-2xl tracking-tighter">TOMA DE <span className="italic font-light text-ochre">DECISIONES</span></span>
          </div>
          <span className="text-[10px] font-sans tracking-[0.5em] uppercase text-clay -mt-1">EL DESEMPATE</span>
        </button>
        <div className="flex items-center gap-4 sm:gap-10">
          <button 
            onClick={() => setView('new')}
            className={`text-[10px] font-sans tracking-[0.4em] uppercase transition-all ${view === 'new' ? 'text-ochre border-b border-ochre pb-1' : 'text-clay hover:text-navy'}`}
          >
            NUEVA ENTRADA
          </button>
          <button 
            onClick={() => setView('history')}
            className={`text-[10px] font-sans tracking-[0.4em] uppercase transition-all ${view === 'history' ? 'text-ochre border-b border-ochre pb-1' : 'text-clay hover:text-navy'}`}
          >
            ARCHIVO
          </button>
          <button onClick={handleLogout} className="p-3 text-clay hover:text-navy hover:bg-sand-dark transition-all rounded-full">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pb-24">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="text-center py-12"
            >
              <h2 className="text-xs font-sans uppercase tracking-[0.6em] text-clay mb-12">ESPACIO DE REFLEXIÓN</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                <Card 
                  onClick={() => setView('new')}
                  rotation={-2}
                  withTape={true}
                  tapeColor="#92abb3"
                  className="cursor-pointer group flex flex-col items-center !py-12"
                >
                  <div className="bg-sand/50 w-20 h-20 flex items-center justify-center mb-8 group-hover:bg-navy group-hover:text-white transition-all shadow-inner border border-navy/5">
                    <PlusCircle size={32} />
                  </div>
                  <h3 className="text-sm font-sans uppercase tracking-[0.3em] mb-4">Nueva Entrada</h3>
                  <p className="text-xl font-writing text-clay leading-snug px-4">"Plantea un nuevo escenario y deja que la consciencia fluya."</p>
                </Card>
                
                <Card 
                  onClick={() => setView('history')}
                  rotation={2}
                  withTape={true}
                  tapeColor="#b3a270"
                  className="cursor-pointer group flex flex-col items-center !py-12"
                >
                  <div className="bg-sand/50 w-20 h-20 flex items-center justify-center mb-8 group-hover:bg-ochre group-hover:text-white transition-all shadow-inner border border-ochre/10">
                    <History size={32} />
                  </div>
                  <h3 className="text-sm font-sans uppercase tracking-[0.3em] mb-4">Ver Archivo</h3>
                  <p className="text-xl font-writing text-clay leading-snug px-4">"Revisa tus anotaciones pasadas y observa tu evolución."</p>
                </Card>
              </div>
            </motion.div>
          )}

          {view === 'new' && (
            <motion.div
              key="new"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
               <button onClick={() => setView('home')} className="flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-clay mb-10 hover:text-navy group transition-colors">
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Volver al Inicio
              </button>
              
              <h2 className="text-5xl font-serif italic text-navy mb-4 tracking-tighter">Nueva Reflexión</h2>
              <p className="text-xs font-sans uppercase tracking-[0.4em] text-clay mb-12">ANOTACIONES DE HOY</p>
              
              <Card rotation={0} className="!p-12 mb-12">
                <div className="space-y-12">
                  <div className="bg-ochre/5 border-l-2 border-ochre p-6 space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-sans uppercase tracking-[0.4em] text-ochre">
                      <Info size={14} /> Guía de Contexto
                    </div>
                    <motion.p 
                      key={analysisType}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-lg font-writing text-clay leading-snug italic"
                    >
                      {analysisType === 'pros_cons' && "Para un análisis efectivo de Luces y Sombras, intenta detallar al menos 3 factores positivos y 3 riesgos que te preocupen. No omitas lo que te dicta la intuición."}
                      {analysisType === 'swot' && "Considera tanto tus habilidades personales (Fortalezas) como aquello que te frena (Debilidades), junto con los factores externos que no puedes controlar."}
                      {analysisType === 'matrix' && "Nombra las opciones principales (ej: Opción A y B) y define qué vas a priorizar: ¿Es el costo, el tiempo, el bienestar emocional o el impacto a largo plazo?"}
                      {analysisType === 'hats' && "Trata de separar los datos fríos de tus sentimientos. ¿Qué te dicen los hechos y qué te dice tu miedo o entusiasmo? No olvides pensar en el 'peor escenario'."}
                      {analysisType === 'regret' && "Visualízate en el futuro. ¿Cómo te sentirás con esta elección mañana mismo? ¿Y dentro de un año? Busca la opción que menos pesadez te genere a largo plazo."}
                      {analysisType === 'decision_tree' && "Dibuja mentalmente los '¿y si...?'. Si elijo A, ¿qué es lo más probable que pase? Si elijo B, ¿cuál es el segundo paso lógico?"}
                      {analysisType === 'delphi' && "Imagina que tienes a los mejores expertos frente a ti. ¿Qué les preguntarías? Describe el dilema de forma que alguien ajeno a tu vida pueda entenderlo."}
                    </motion.p>
                  </div>

                  <div className="relative">
                    <label className="block text-[10px] font-sans uppercase tracking-[0.5em] text-clay mb-4">Título del Dilema</label>
                    <input 
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="ESCRIBE AQUÍ..."
                      className="w-full text-4xl font-serif bg-transparent border-b border-navy/10 py-4 focus:border-ochre outline-none transition-colors placeholder:text-clay/20 uppercase"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-end mb-4">
                      <label className="block text-[10px] font-sans uppercase tracking-[0.5em] text-clay">Contenido / Detalles</label>
                      <motion.span 
                        key={analysisType}
                        initial={{ opacity: 0, x: 5 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-[9px] font-sans text-ochre tracking-widest uppercase italic max-w-[60%] text-right leading-tight"
                      >
                        {analysisType === 'pros_cons' && "Enumera los factores positivos (luces) y los riesgos o dudas (sombras)."}
                        {analysisType === 'swot' && "Describe tus capacidades internas y el entorno exterior (amenazas/oportunidades)."}
                        {analysisType === 'matrix' && "Define 2 o más opciones claras y los criterios importantes para evaluarlas."}
                        {analysisType === 'hats' && "Explora hechos, emociones, riesgos, beneficios y creatividad en conjunto."}
                        {analysisType === 'regret' && "Proyecta consecuencias a 10 min, 10 meses y 10 años para minimizar el arrepentimiento."}
                        {analysisType === 'decision_tree' && "Plantea una elección inicial y los caminos o ramificaciones posibles."}
                        {analysisType === 'delphi' && "Analiza el problema desde diversas áreas expertas (ej: finanzas, bienestar)."}
                      </motion.span>
                    </div>
                    <textarea 
                      rows={8}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe el contexto, tus dudas y lo que sientes..."
                      className="w-full text-2xl font-writing bg-sand/20 border border-navy/5 p-8 focus:border-ochre outline-none resize-none leading-relaxed shadow-inner italic"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-sans uppercase tracking-[0.5em] text-clay mb-8 text-center">Metodología Consciente</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[
                        { id: 'pros_cons', label: 'LUCES Y SOMBRAS', icon: <Scale size={16} /> },
                        { id: 'swot', label: 'ESTRATEGIA FODA', icon: <Grid3X3 size={16} /> },
                        { id: 'matrix', label: 'MATRIZ DE DATOS', icon: <Target size={16} /> },
                        { id: 'hats', label: 'MULTIPLICIDAD', icon: <Info size={16} /> },
                        { id: 'regret', label: 'VISIÓN TEMPORAL', icon: <AlertCircle size={16} /> },
                        { id: 'decision_tree', label: 'ÁRBOL LÓGICO', icon: <BrainCircuit size={16} /> },
                        { id: 'delphi', label: 'CONSULTA DELPHI', icon: <PlusCircle size={16} /> },
                      ].map((type, i) => (
                        <button
                          key={type.id}
                          onClick={() => setAnalysisType(type.id as AnalysisType)}
                          className={`flex items-center gap-3 p-5 border transition-all text-[10px] font-sans uppercase tracking-widest ${
                            analysisType === type.id 
                            ? 'bg-navy text-white border-navy scale-[1.02] shadow-lg' 
                            : 'bg-white text-clay border-clay/10 hover:border-navy/30'
                          }`}
                        >
                          <span className={`${analysisType === type.id ? 'text-ochre' : 'text-clay/40'}`}>{type.icon}</span>
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-sand/30 p-8 border border-navy/5">
                    <p className="text-[10px] font-sans uppercase tracking-[0.3em] text-clay leading-loose">
                      <span className="text-navy font-bold">Consejo:</span> Cuanto más detallado seas en la descripción superior, más precisa será la respuesta de la IA. El contexto emocional es tan valioso como los datos cuantitativos.
                    </p>
                  </div>
                  
                  <div className="pt-8">
                    <Button 
                      onClick={() => handleCreateDecision()} 
                      className="w-full text-sm tracking-[0.4em] py-6" 
                      loading={isAnalyzing}
                      disabled={!title || !description}
                    >
                      {isAnalyzing ? "PROCESANDO..." : "GENERAR ANÁLISIS"}
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {view === 'result' && selectedDecision && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex justify-between items-start mb-10">
                <button onClick={() => setView('history')} className="flex items-center gap-2 text-[10px] font-sans uppercase tracking-[0.4em] text-clay hover:text-navy transition-colors">
                  <ArrowLeft size={14} /> ARCHIVO DIARIO
                </button>
                <div className="flex gap-4">
                  <Button onClick={() => setView('new')} variant="ghost" className="text-[10px] tracking-[0.3em] !py-2">
                    NUEVA ENTRADA
                  </Button>
                </div>
              </div>
              
              <div className="mb-16 text-center">
                <h2 className="text-7xl font-serif text-navy mb-6 tracking-tighter leading-tight">
                  {selectedDecision.title.split(' ').map((word, i) => i === 1 ? <span key={i} className="italic font-light text-ochre mr-2">{word} </span> : word + ' ')}
                </h2>
                <div className="max-w-2xl mx-auto">
                    <p className="text-2xl font-writing text-clay leading-relaxed italic border-x border-navy/10 px-8 py-2">
                        {selectedDecision.description}
                    </p>
                </div>
              </div>

              <div className="space-y-20">
                {/* Manual Notes Section */}
                <Card className="!p-12 relative overflow-hidden" rotation={0.5}>
                  <div className="absolute top-0 left-0 w-1 pt-24 h-full bg-ochre/10" />
                  <h3 className="text-sm font-sans uppercase tracking-[0.5em] text-dusty mb-8 flex items-center gap-3">
                    <PlusCircle size={16} className="text-ochre" /> ANOTACIONES PERSONALES
                  </h3>
                  <textarea
                    value={selectedDecision.notes || ''}
                    onChange={(e) => handleUpdateNotes(selectedDecision.id, e.target.value)}
                    placeholder="Escribe tus reflexiones, sentimientos o dudas que surjan al leer este análisis..."
                    className="w-full min-h-[200px] text-2xl font-writing bg-transparent border-none focus:ring-0 outline-none resize-none leading-relaxed text-navy italic placeholder:opacity-30 p-0"
                  />
                  <div className="mt-4 flex justify-end">
                    <span className="text-[8px] font-sans uppercase tracking-[0.4em] text-clay/40 italic">
                      Las anotaciones se guardan automáticamente
                    </span>
                  </div>
                </Card>

                {selectedDecision.type === 'pros_cons' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <Card className="!p-10" rotation={-1} withTape={true} tapeColor="#92abb3">
                      <h3 className="text-sm font-sans uppercase tracking-[0.5em] text-dusty mb-8 flex items-center gap-3">
                        <CheckCircle2 size={16} /> LUCES
                      </h3>
                      <ul className="space-y-6 font-writing text-2xl">
                        {selectedDecision.analysis.pros.map((p: string, i: number) => (
                          <li key={i} className="flex gap-4 text-navy border-b border-navy/5 pb-2">
                            <span className="text-ochre">/</span> {p}
                          </li>
                        ))}
                      </ul>
                    </Card>
                    <Card className="!p-10" rotation={1} withTape={true} tapeColor="#b08d75">
                      <h3 className="text-sm font-sans uppercase tracking-[0.5em] text-clay mb-8 flex items-center gap-3">
                        <AlertCircle size={16} /> SOMBRAS
                      </h3>
                      <ul className="space-y-6 font-writing text-2xl">
                        {selectedDecision.analysis.cons.map((c: string, i: number) => (
                          <li key={i} className="flex gap-4 text-navy border-b border-navy/5 pb-2">
                            <span className="text-red-800">/</span> {c}
                          </li>
                        ))}
                      </ul>
                    </Card>
                    <Card className="md:col-span-2 bg-navy p-16 text-center" rotation={0}>
                      <h3 className="text-[10px] font-sans uppercase tracking-[0.6em] text-ochre mb-6">SÍNTESIS CONSCIENTE</h3>
                      <p className="font-serif italic text-4xl text-white leading-snug">"{selectedDecision.analysis.conclusion}"</p>
                    </Card>
                  </div>
                )}

                {selectedDecision.type === 'swot' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                    {[
                      { title: 'ESTRATEGIA', items: selectedDecision.analysis.strengths, color: 'text-navy', rot: -0.5 },
                      { title: 'DISEÑO', items: selectedDecision.analysis.weaknesses, color: 'text-clay', rot: 0.5 },
                      { title: 'EJECUCIÓN', items: selectedDecision.analysis.opportunities, color: 'text-dusty', rot: 0.8 },
                      { title: 'OPTIMIZACIÓN', items: selectedDecision.analysis.threats, color: 'text-ochre', rot: -0.8 }
                    ].map((sec) => (
                      <Card key={sec.title} className="bg-white" rotation={sec.rot} withTape={true} tapeColor="#f2f2f2">
                        <h4 className={`text-[10px] font-sans uppercase tracking-[0.5em] mb-6 border-b border-navy/5 pb-2 ${sec.color}`}>{sec.title}</h4>
                        <ul className="space-y-4 font-writing text-2xl">
                          {sec.items.map((item: string, i: number) => (
                            <li key={i} className="flex gap-2">
                              <span className="opacity-30">/</span> {item}
                            </li>
                          ))}
                        </ul>
                      </Card>
                    ))}
                  </div>
                )}

                {selectedDecision.type === 'matrix' && (
                  <Card className="overflow-hidden !p-12" rotation={0}>
                    <h3 className="text-xs font-sans uppercase tracking-[0.5em] text-clay mb-10 text-center">MATRIZ DE INFORMACIÓN</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-writing text-2xl">
                        <thead>
                          <tr className="border-b border-navy/10">
                            <th className="py-6 font-sans text-[10px] uppercase tracking-widest text-clay">OPCIÓN</th>
                            {selectedDecision.analysis.criteria.map((c: any) => (
                              <th key={c.name} className="py-6 px-4 font-sans text-[10px] uppercase tracking-widest text-navy text-center">
                                {c.name}<br/>
                                <span className="opacity-40 font-light italic mt-1 inline-block lowercase tracking-normal">peso: {c.weight}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDecision.analysis.options.map((opt: any) => (
                            <tr key={opt.name} className="border-b border-navy/5 last:border-0 hover:bg-sand/30 transition-colors">
                              <td className="py-8 font-serif italic text-2xl text-navy">{opt.name}</td>
                              {selectedDecision.analysis.criteria.map((c: any) => (
                                <td key={c.name} className="py-8 px-4 text-center">
                                  <div className="inline-flex items-center justify-center w-14 h-14 border border-navy/10 bg-navy/5 text-navy font-bold">
                                    {opt.scores[c.name] || opt.scores[c.name.toLowerCase()] || 0}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {selectedDecision.type === 'hats' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[
                      { id: 'white', label: 'DATOS', color: 'bg-white', text: 'text-navy', content: selectedDecision.analysis.white, rot: -0.5 },
                      { id: 'red', label: 'EMOCIONES', color: 'bg-white', text: 'text-clay', content: selectedDecision.analysis.red, rot: 0.5 },
                      { id: 'black', label: 'CRÍTICA', color: 'bg-navy', text: 'text-white', content: selectedDecision.analysis.black, rot: -0.3 },
                      { id: 'yellow', label: 'OPTIMISMO', color: 'bg-white', text: 'text-gold', content: selectedDecision.analysis.yellow, rot: 0.8 },
                      { id: 'green', label: 'MENTALIDAD', color: 'bg-white', text: 'text-dusty', content: selectedDecision.analysis.green, rot: -0.5 },
                      { id: 'blue', label: 'PROPÓSITO', color: 'bg-ochre', text: 'text-white', content: selectedDecision.analysis.blue, rot: 0.3 },
                    ].map((hat) => (
                      <Card key={hat.id} className={`${hat.color} !p-8 shadow-lg`} rotation={hat.rot}>
                        <h4 className={`text-[10px] font-sans uppercase tracking-[0.4em] mb-4 border-b border-current/20 pb-2 ${hat.text}`}>{hat.label}</h4>
                        <p className={`font-writing text-2xl ${hat.text} opacity-90 leading-tight italic`}>{hat.content}</p>
                      </Card>
                    ))}
                  </div>
                )}

                {selectedDecision.type === 'decision_tree' && (
                  <div className="space-y-12">
                    <Card rotation={0} className="!p-16 relative">
                      <div className="absolute top-8 right-8">
                        <BrainCircuit size={48} className="text-ochre opacity-20" />
                      </div>
                      <h3 className="text-xs font-sans uppercase tracking-[0.5em] text-clay mb-10 pb-4 border-b border-navy/5">ÁRBOL LÓGICO DE ACCIÓN</h3>
                      <p className="font-serif italic text-4xl mb-16 text-navy">Punto de partida: {selectedDecision.analysis.initial_choice}</p>
                      <div className="grid grid-cols-1 gap-12">
                        {selectedDecision.analysis.branches.map((branch: any, i: number) => (
                          <div key={i} className="flex gap-10 items-start group">
                             <div className="font-serif text-6xl text-ochre opacity-20 group-hover:opacity-100 transition-opacity">0{i+1}</div>
                             <div className="space-y-6 pt-2">
                                <h4 className="text-xs font-sans uppercase tracking-[0.3em] text-navy">{branch.action}</h4>
                                <p className="font-writing text-3xl text-clay leading-relaxed">Resultado: <span className="text-navy">{branch.outcome}</span></p>
                                <div className="flex gap-8 text-[10px] font-sans uppercase tracking-widest">
                                  <span className="bg-dusty/10 px-4 py-2 text-navy">PROBABILIDAD: {branch.probability}</span>
                                  <span className="bg-clay/10 px-4 py-2 text-clay">RIESGO: {branch.risk}</span>
                                </div>
                             </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                )}

                {selectedDecision.type === 'delphi' && (
                  <div className="space-y-12">
                    <Card rotation={0} className="bg-navy p-16 text-center shadow-2xl">
                      <h3 className="text-[10px] font-sans uppercase tracking-[0.6em] text-ochre mb-8">CONSENSO DE PANEL</h3>
                      <p className="font-serif italic text-4xl text-ochre leading-snug">"{selectedDecision.analysis.consensus_summary}"</p>
                    </Card>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {selectedDecision.analysis.expert_panel.map((expert: any, i: number) => (
                        <Card key={i} rotation={(i % 2 === 0 ? 0.8 : -0.8)} className="bg-white !p-10">
                          <h4 className="text-[10px] font-sans uppercase tracking-[0.4em] text-clay mb-4">{expert.role}</h4>
                          <p className="font-writing text-2xl text-navy mb-8 leading-snug italic">"{expert.opinion}"</p>
                          <div className="space-y-3">
                             <div className="flex justify-between text-[10px] font-sans tracking-widest text-clay uppercase">
                                <span>GRADO DE ACUERDO</span>
                                <span className="text-navy">{expert.score * 10}%</span>
                             </div>
                             <div className="h-1 bg-sand overflow-hidden">
                                <div className="h-full bg-ochre transition-all" style={{ width: `${expert.score * 10}%` }} />
                             </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDecision.type === 'regret' && (
                  <div className="space-y-8">
                    {[
                      { label: 'En 10 Minutos...', content: selectedDecision.analysis.short_term, icon: <AlertCircle />, rot: -0.5 },
                      { label: 'En 10 Meses...', content: selectedDecision.analysis.medium_term, icon: <Target />, rot: 0.8 },
                      { label: 'En 10 Años...', content: selectedDecision.analysis.long_term, icon: <History />, rot: -0.3 }
                    ].map((step, i) => (
                      <Card key={i} className="flex gap-8 items-start hover:translate-x-1 transition-transform" rotation={step.rot}>
                        <div className="bg-celeste/30 p-4 rounded-2xl text-azul shrink-0">
                          {step.icon}
                        </div>
                        <div>
                          <h4 className="font-display text-2xl mb-2 text-earth">{step.label}</h4>
                          <p className="font-writing text-2xl text-earth-light leading-normal">{step.content}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Alternative Methods Section */}
                <div className="pt-20 border-t border-navy/5">
                  <h3 className="text-[10px] font-sans uppercase tracking-[0.6em] text-center mb-12 text-clay">Explorar otras perspectivas</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { id: 'pros_cons', label: 'LUCES Y SOMBRAS', icon: <Scale size={14} /> },
                      { id: 'swot', label: 'ESTRATEGIA FODA', icon: <Grid3X3 size={14} /> },
                      { id: 'matrix', label: 'MATRIZ DE DATOS', icon: <Target size={14} /> },
                      { id: 'hats', label: 'MULTIPLICIDAD', icon: <Info size={14} /> },
                      { id: 'regret', label: 'VISIÓN TEMPORAL', icon: <AlertCircle size={14} /> },
                      { id: 'decision_tree', label: 'ÁRBOL LÓGICO', icon: <BrainCircuit size={14} /> },
                      { id: 'delphi', label: 'CONSULTA DELPHI', icon: <PlusCircle size={14} /> },
                    ].filter(m => m.id !== selectedDecision.type).map((method) => (
                      <button
                        key={method.id}
                        disabled={isAnalyzing}
                        onClick={() => handleCreateDecision(selectedDecision.title, selectedDecision.description, method.id as any)}
                        className="flex items-center gap-3 p-5 border border-clay/10 bg-white hover:border-navy/30 transition-all text-[9px] font-sans uppercase tracking-widest text-clay hover:text-navy disabled:opacity-50"
                      >
                        <span className="text-clay/30">{method.icon}</span>
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Return button */}
                <div className="flex justify-center pt-10">
                  <Button onClick={() => setView('home')} variant="ghost" className="text-[10px] tracking-[0.5em]">
                    CERRAR ARCHIVO
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h2 className="text-5xl font-serif text-navy mb-4 tracking-tighter">Archivo Diario</h2>
              <p className="text-xs font-sans uppercase tracking-[0.5em] text-clay mb-16">REGISTROS CONSCIENTES</p>
              
              {decisions.length === 0 ? (
                <Card className="text-center py-32 bg-white/30" rotation={0}>
                  <p className="text-2xl font-writing text-clay italic">"El archivo está en blanco. Una oportunidad para empezar de nuevo."</p>
                  <Button onClick={() => setView('new')} variant="secondary" className="mt-12 mx-auto">
                    NUEVA ENTRADA
                  </Button>
                </Card>
              ) : (
                <div className="space-y-12">
                  {decisions.map((d, idx) => (
                    <motion.div
                      key={d.id}
                      layout
                      onClick={() => { setSelectedDecision(d); setView('result'); }}
                      className="group cursor-pointer relative"
                    >
                      <Card rotation={(idx % 2 === 0 ? 0.3 : -0.3)} className="flex items-center gap-10 !py-10 hover:translate-x-3 transition-transform duration-500">
                        <div className="w-24 h-24 bg-sand border border-navy/5 flex items-center justify-center text-clay group-hover:bg-navy group-hover:text-white transition-all shadow-inner relative overflow-hidden">
                          {d.type === 'pros_cons' && <Scale size={32} />}
                          {d.type === 'swot' && <Grid3X3 size={32} />}
                          {d.type === 'matrix' && <Target size={32} />}
                          {d.type === 'hats' && <Info size={32} />}
                          {d.type === 'regret' && <AlertCircle size={32} />}
                          {d.type === 'decision_tree' && <BrainCircuit size={32} />}
                          {d.type === 'delphi' && <PlusCircle size={32} />}
                          <div className="absolute top-0 left-0 w-full h-[2px] bg-white opacity-20" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-3xl font-serif text-navy mb-2 tracking-tight group-hover:text-ochre transition-colors">{d.title}</h4>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-sans tracking-widest text-clay uppercase italic">
                              {new Date(d.createdAt?.seconds * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                            <span className="w-1 h-1 bg-clay/20 rounded-full" />
                            <span className="text-[10px] font-sans tracking-widest text-ochre uppercase">{d.type.replace('_', ' ')}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <button 
                            onClick={(e) => handleDeleteDecision(d.id, e)}
                            className="p-4 text-clay/20 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={24} />
                          </button>
                          <ChevronRight className="text-clay/20 group-hover:text-navy group-hover:translate-x-1 transition-all" size={32} />
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-4xl mx-auto px-6 py-20 text-center opacity-40">
        <div className="h-px bg-navy/10 w-full mb-8" />
      </footer>

      {/* Floating Action Button (FAB) on mobile */}
      {view !== 'new' && view !== 'result' && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setView('new')}
          className="fixed bottom-8 right-8 bg-navy text-white p-5 shadow-2xl flex items-center justify-center z-50 md:hidden border-t border-white/20"
        >
          <PlusCircle size={24} />
        </motion.button>
      )}
    </div>
  );
}
