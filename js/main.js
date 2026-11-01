"use strict";

const encabezado = document.querySelector("#encabezado");
const menu = document.querySelector("#menu-movil");
const abrirMenu = document.querySelector("#menu-abrir");
const cerrarMenu = document.querySelector("#menu-cerrar");
const contenido = document.querySelector("main");
const pie = document.querySelector("footer");
const pantallaMovil = window.matchMedia("(width < 860px)");
const movimientoReducido = window.matchMedia("(prefers-reduced-motion: reduce)");
let actualizacionPendiente = false;
let posicionGuardada = 0;

// Entrada única: conserva los nodos <br>/<em> y los espacios entre palabras.
function prepararEntradaHero() {
  const raiz = document.documentElement;
  const hero = document.querySelector("#inicio");
  const titulo = hero.querySelector("h1");
  const textoCompleto = titulo.cloneNode(true);
  textoCompleto.querySelectorAll("br").forEach((salto) => salto.replaceWith(" "));
  titulo.setAttribute("aria-label", textoCompleto.textContent.replace(/\s+/g, " ").trim());

  const nodosTexto = [];
  const recorrido = document.createTreeWalker(titulo, NodeFilter.SHOW_TEXT);
  while (recorrido.nextNode()) nodosTexto.push(recorrido.currentNode);
  let indice = 0;
  nodosTexto.forEach((nodo) => {
    const fragmento = document.createDocumentFragment();
    nodo.textContent.split(/(\s+)/).forEach((texto) => {
      if (!texto) return;
      if (/^\s+$/.test(texto)) {
        fragmento.append(document.createTextNode(texto));
        return;
      }
      const recorte = document.createElement("span");
      recorte.className = "hero-palabra-recorte";
      recorte.setAttribute("aria-hidden", "true");
      const palabra = document.createElement("span");
      palabra.className = "hero-palabra";
      palabra.setAttribute("aria-hidden", "true");
      palabra.textContent = texto;
      palabra.style.setProperty("--retraso", `${200 + indice++ * 45}ms`);
      recorte.append(palabra);
      fragmento.append(recorte);
    });
    nodo.replaceWith(fragmento);
  });

  const elementos = [
    [hero.querySelector(".hero-fondo"), 0, 900, "0px"],
    [encabezado, 0, 500, "-8px"],
    [hero.querySelector(".hero-contenido > .etiqueta"), 120, 500, "8px"],
    ...Array.from(titulo.querySelectorAll(".hero-palabra"), (palabra) =>
      [palabra, null, 700, "105%"]),
    [hero.querySelector(".hero-subtitulo"), 650, 600, "12px"],
    ...Array.from(hero.querySelectorAll(".hero-enlaces > a"), (enlace, i) =>
      [enlace, 800 + i * 60, 500, "12px"]),
    // 800 + 600 = 1400 ms: respeta el máximo total de la entrada.
    [hero.querySelector(".hero-desliza"), 800, 600, "0px"],
  ].map(([elemento, retraso, duracion, desplazamiento]) => {
    elemento.classList.add("hero-entrada");
    if (retraso !== null) elemento.style.setProperty("--retraso", `${retraso}ms`);
    elemento.style.setProperty("--entrada-duracion", `${duracion}ms`);
    elemento.style.setProperty("--entrada-y", desplazamiento);
    return elemento;
  });

  raiz.classList.add("hero-animando");
  const espera = (ms) => new Promise((resolver) => window.setTimeout(resolver, ms));
  Promise.race([document.fonts.ready, espera(1200)]).then(() => {
    raiz.classList.add("fuentes-listas");
    // Dos frames aseguran que el navegador haya pintado el estado inicial.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      raiz.classList.add("hero-iniciado");
      const transiciones = elementos.flatMap((elemento) =>
        elemento.getAnimations().map((animacion) => animacion.finished));
      Promise.allSettled(transiciones).then(() => raiz.classList.remove("hero-animando"));
    }));
  });
}

prepararEntradaHero();

function actualizarEncabezado() {
  const posicion = menu.hidden ? window.scrollY : posicionGuardada;
  encabezado.classList.toggle("con-scroll", posicion > 24);
  actualizacionPendiente = false;
}

window.addEventListener("scroll", () => {
  if (!actualizacionPendiente) {
    actualizacionPendiente = true;
    window.requestAnimationFrame(actualizarEncabezado);
  }
}, { passive: true });

actualizarEncabezado();

function mostrarMenu() {
  if (!pantallaMovil.matches || !menu.hidden) return;

  posicionGuardada = window.scrollY;
  document.body.style.top = `-${posicionGuardada}px`;
  document.body.classList.add("menu-abierto");
  menu.hidden = false;
  abrirMenu.setAttribute("aria-expanded", "true");
  cerrarMenu.focus();
  encabezado.inert = true;
  document.querySelector(".saltar-contenido").inert = true;
  contenido.inert = true;
  pie.inert = true;
}

function ocultarMenu(devolverFoco = true) {
  if (menu.hidden) return;

  menu.hidden = true;
  abrirMenu.setAttribute("aria-expanded", "false");
  encabezado.inert = false;
  document.querySelector(".saltar-contenido").inert = false;
  contenido.inert = false;
  pie.inert = false;
  document.body.classList.remove("menu-abierto");
  document.body.style.top = "";
  window.scrollTo({ top: posicionGuardada, behavior: "instant" });
  if (devolverFoco) abrirMenu.focus({ preventScroll: true });
}

abrirMenu.addEventListener("click", mostrarMenu);
cerrarMenu.addEventListener("click", () => ocultarMenu());

document.addEventListener("keydown", (evento) => {
  if (menu.hidden) return;

  if (evento.key === "Escape") {
    evento.preventDefault();
    ocultarMenu();
  }

  if (evento.key === "Tab") {
    const controles = menu.querySelectorAll("button, a[href]");
    const primero = controles[0];
    const ultimo = controles[controles.length - 1];

    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }
});

pantallaMovil.addEventListener("change", () => {
  if (!pantallaMovil.matches) {
    const estabaAbierto = !menu.hidden;
    ocultarMenu(false);
    if (estabaAbierto) encabezado.querySelector(".marca").focus({ preventScroll: true });
  }
});

document.addEventListener("click", (evento) => {
  const enlace = evento.target.closest('a[href^="#"]');
  if (!enlace || evento.defaultPrevented || evento.button !== 0 ||
      evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;

  const ancla = enlace.getAttribute("href");
  if (ancla === "#") return;

  const destino = document.getElementById(ancla.slice(1));
  if (!destino) return;

  evento.preventDefault();
  ocultarMenu(false);
  if (window.location.hash !== ancla) window.history.pushState(null, "", ancla);
  destino.focus({ preventScroll: true });
  destino.scrollIntoView({
    behavior: movimientoReducido.matches || evento.detail === 0 ? "instant" : "smooth",
    block: "start",
  });
});

// Las fotos son decorativas: el degradado queda visible mientras faltan o cargan.
document.querySelectorAll("[data-foto-fondo]").forEach((capa) => {
  const foto = capa.querySelector("img");
  const actualizarFoto = () => {
    capa.classList.toggle("foto-lista", foto.complete && foto.naturalWidth > 0);
  };

  foto.addEventListener("load", actualizarFoto);
  foto.addEventListener("error", actualizarFoto);
  actualizarFoto();
});

const apariciones = document.querySelectorAll("[data-aparece]");
let observadorApariciones;

function prepararApariciones() {
  if (observadorApariciones) observadorApariciones.disconnect();

  if (movimientoReducido.matches || !("IntersectionObserver" in window)) {
    apariciones.forEach((elemento) => elemento.classList.add("visible"));
    return;
  }

  observadorApariciones = new IntersectionObserver((entradas, observador) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      entrada.target.classList.add("visible");
      observador.unobserve(entrada.target);
    });
  }, { threshold: .12 });

  apariciones.forEach((elemento) => {
    if (elemento.classList.contains("visible")) return;
    const hermanos = Array.from(elemento.parentElement.children)
      .filter((hermano) => hermano.matches("[data-aparece]"));
    elemento.style.setProperty("--aparece-retraso", `${Math.min(hermanos.indexOf(elemento), 2) * 40}ms`);
    elemento.classList.add("aparece-listo");
    observadorApariciones.observe(elemento);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", prepararApariciones, { once: true });
} else {
  prepararApariciones();
}
movimientoReducido.addEventListener("change", prepararApariciones);

// El enlace de Facebook permanece disponible incluso sin JavaScript o sin JSON.
async function cargarActividades() {
  const seccion = document.querySelector("#actividades");
  const lista = document.querySelector("#actividades-lista");

  try {
    const respuesta = await fetch("data/actividades.json", { cache: "no-cache" });
    if (!respuesta.ok) throw new Error("No se pudieron cargar las actividades.");
    const actividades = await respuesta.json();
    const campos = ["titulo", "fecha", "resumen", "foto", "enlace"];
    if (!Array.isArray(actividades) || !actividades.length || actividades.some((actividad) =>
      !actividad || campos.some((campo) => typeof actividad[campo] !== "string"))) {
      throw new Error("Los datos de actividades no son válidos.");
    }

    const tarjetas = document.createDocumentFragment();
    actividades.forEach((actividad) => {
      const tarjeta = document.createElement("article");
      tarjeta.className = "actividad-tarjeta";
      const enlace = document.createElement("a");
      enlace.className = "actividad-enlace";
      enlace.href = actividad.enlace;

      const marco = document.createElement("div");
      marco.className = "actividad-foto";
      const foto = document.createElement("img");
      // La miniatura acompaña al título del enlace; no repite su nombre al lector.
      foto.alt = "";
      foto.loading = "lazy";
      foto.decoding = "async";
      foto.addEventListener("load", () => marco.classList.add("foto-lista"));
      foto.addEventListener("error", () => {
        marco.classList.remove("foto-lista");
        foto.hidden = true;
      });
      foto.src = actividad.foto;
      marco.append(foto);

      const texto = document.createElement("div");
      texto.className = "actividad-contenido";
      if (actividad.fecha.trim()) {
        const fecha = document.createElement("p");
        fecha.className = "etiqueta";
        fecha.textContent = actividad.fecha;
        texto.append(fecha);
      }
      const titulo = document.createElement("h3");
      titulo.className = "actividad-titulo";
      titulo.textContent = actividad.titulo;
      texto.append(titulo);
      if (actividad.resumen.trim()) {
        const resumen = document.createElement("p");
        resumen.className = "actividad-resumen";
        resumen.textContent = actividad.resumen;
        texto.append(resumen);
      }
      enlace.append(marco, texto);
      tarjeta.append(enlace);
      tarjetas.append(tarjeta);
    });

    lista.replaceChildren(tarjetas);
    lista.hidden = false;
  } catch {
    lista.replaceChildren();
    lista.hidden = true;
    // Conserva el encabezado y el enlace de Facebook si falla la fuente de datos.
  }
}

cargarActividades();

const miniaturas = Array.from(document.querySelectorAll(".galeria-miniatura"));
const visor = document.querySelector("#galeria-visor");
const fotoVisor = visor.querySelector(".visor-foto");
const errorVisor = visor.querySelector(".visor-error");
const cerrarVisor = visor.querySelector(".visor-cerrar");
const anteriorVisor = document.querySelector("#visor-anterior");
const siguienteVisor = document.querySelector("#visor-siguiente");
const posicionVisor = document.querySelector("#visor-posicion");
let indiceVisor = 0;
let miniaturaOrigen;
let scrollVisor = 0;

miniaturas.forEach((miniatura, indice) => {
  const foto = miniatura.querySelector("img");
  const actualizar = () => {
    const lista = foto.complete && foto.naturalWidth > 0;
    foto.classList.toggle("foto-lista", lista);
    foto.hidden = foto.complete && !lista;
  };
  foto.addEventListener("load", actualizar);
  foto.addEventListener("error", actualizar);
  actualizar();

  miniatura.addEventListener("click", () => {
    miniaturaOrigen = miniatura;
    mostrarFotoVisor(indice);
    scrollVisor = window.scrollY;
    document.body.style.top = `-${scrollVisor}px`;
    document.body.classList.add("visor-abierto");
    visor.showModal();
    cerrarVisor.focus({ preventScroll: true });
  });
});

function actualizarFotoVisor() {
  const lista = fotoVisor.complete && fotoVisor.naturalWidth > 0;
  fotoVisor.closest("figure").setAttribute("aria-busy", String(!fotoVisor.complete));
  fotoVisor.hidden = !lista;
  errorVisor.hidden = !fotoVisor.complete || lista;
}

function mostrarFotoVisor(indice) {
  indiceVisor = (indice + miniaturas.length) % miniaturas.length;
  const original = miniaturas[indiceVisor].querySelector("img");
  fotoVisor.hidden = true;
  errorVisor.hidden = true;
  fotoVisor.closest("figure").setAttribute("aria-busy", "true");
  fotoVisor.alt = original.alt;
  fotoVisor.src = original.currentSrc || original.src;
  posicionVisor.textContent = `${indiceVisor + 1} / ${miniaturas.length}`;
  actualizarFotoVisor();
}

fotoVisor.addEventListener("load", actualizarFotoVisor);
fotoVisor.addEventListener("error", actualizarFotoVisor);
cerrarVisor.addEventListener("click", () => visor.close());
anteriorVisor.addEventListener("click", () => mostrarFotoVisor(indiceVisor - 1));
siguienteVisor.addEventListener("click", () => mostrarFotoVisor(indiceVisor + 1));

visor.addEventListener("keydown", (evento) => {
  if (evento.key === "ArrowLeft" || evento.key === "ArrowRight") {
    evento.preventDefault();
    mostrarFotoVisor(indiceVisor + (evento.key === "ArrowLeft" ? -1 : 1));
  }

  if (evento.key === "Tab") {
    const primero = cerrarVisor;
    const ultimo = siguienteVisor;
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }
});

// Escape utiliza el cierre nativo de <dialog>; todos los cierres restauran el foco.
visor.addEventListener("close", () => {
  document.body.classList.remove("visor-abierto");
  document.body.style.top = "";
  window.scrollTo({ top: scrollVisor, behavior: "instant" });
  miniaturaOrigen?.focus({ preventScroll: true });
});

// Animación del logo: quieta en el primer cuadro final si se pide menos movimiento.
const videoAnillo = document.querySelector(".gybn-anillo");
if (videoAnillo && movimientoReducido.matches) {
  videoAnillo.removeAttribute("autoplay");
  videoAnillo.pause();
  videoAnillo.addEventListener("loadedmetadata", () => { videoAnillo.currentTime = videoAnillo.duration - 0.1; }, { once: true });
}
