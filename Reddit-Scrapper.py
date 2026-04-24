import requests
import pandas as pd
import time
import os
import datetime
import threading
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox

# --- CONFIGURACIÓN DE ESTILO ---
COLORS = {
    'bg': '#f5f5f5',          # Fondo claro
    'fg': '#333333',          # Texto oscuro
    'accent': '#007acc',      # Azul estándar
    'accent_hover': '#005fa3',
    'secondary_bg': '#e0e0e0',# Fondo secundario (gris suave)
    'entry_bg': '#ffffff',    # Fondo blanco para inputs
    'success': '#008000',     # Verde oscuro para texto sobre blanco
    'error': '#d32f2f',       # Rojo
    'log_bg': '#ffffff',      # Log fondo blanco
    'log_fg': '#333333'       # Log texto oscuro
}

FONTS = {
    'header': ('Segoe UI', 18, 'bold'),
    'sub_header': ('Segoe UI', 12, 'bold'),
    'body': ('Segoe UI', 10),
    'mono': ('Consolas', 9)
}

class RedditScraperGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Reddit Scraper Pro")
        self.root.geometry("700x650")
        self.root.configure(bg=COLORS['bg'])
        
        self.setup_styles()
        
        # Estado del scraping
        self.stop_event = threading.Event()
        self.is_running = False
        
        # --- UI LAYOUT ---
        main_container = ttk.Frame(root, style='Main.TFrame')
        main_container.pack(fill="both", expand=True, padx=20, pady=20)
        
        # Header
        header_frame = ttk.Frame(main_container, style='Main.TFrame')
        header_frame.pack(fill="x", pady=(0, 20))
        
        lbl_title = ttk.Label(header_frame, text="Reddit Community Scraper", style='Header.TLabel')
        lbl_title.pack(side="left")
        
        lbl_subtitle = ttk.Label(header_frame, text="v2.0 Modern", style='SubHeader.TLabel')
        lbl_subtitle.pack(side="left", padx=10, pady=(8, 0))

        # 1. Configuración de la Comunidad
        frame_config = ttk.LabelFrame(main_container, text=" Configuración ", style='Card.TLabelframe')
        frame_config.pack(fill="x", pady=10, ipady=5)
        
        # Grid para inputs
        frame_inputs = ttk.Frame(frame_config, style='Card.TFrame')
        frame_inputs.pack(fill="x", padx=15, pady=10)
        
        # Subreddit Input
        ttk.Label(frame_inputs, text="Nombre de la Comunidad (r/):", style='Body.TLabel').grid(row=0, column=0, sticky="w", pady=5)
        self.entry_subreddit = ttk.Entry(frame_inputs, width=30, style='Modern.TEntry')
        self.entry_subreddit.grid(row=0, column=1, padx=10, pady=5, sticky="w")
        self.entry_subreddit.insert(0, "Ticos") # Default example
        
        # 2. Tipos de datos
        ttk.Label(frame_inputs, text="Recolectar:", style='Body.TLabel').grid(row=1, column=0, sticky="w", pady=15)
        
        frame_checks = ttk.Frame(frame_inputs, style='Card.TFrame')
        frame_checks.grid(row=1, column=1, padx=10, pady=5, sticky="w")
        
        self.var_posts = tk.BooleanVar(value=True)
        self.var_comments = tk.BooleanVar(value=False)
        
        chk_posts = ttk.Checkbutton(frame_checks, text="Posts", variable=self.var_posts, style='Modern.TCheckbutton')
        chk_posts.pack(side="left", padx=(0, 15))
        
        chk_comments = ttk.Checkbutton(frame_checks, text="Comentarios", variable=self.var_comments, style='Modern.TCheckbutton')
        chk_comments.pack(side="left")

        # 3. Fechas
        frame_dates = ttk.LabelFrame(main_container, text=" Rango de Fechas (Opcional) ", style='Card.TLabelframe')
        frame_dates.pack(fill="x", pady=10, ipady=5)
        
        frame_date_inputs = ttk.Frame(frame_dates, style='Card.TFrame')
        frame_date_inputs.pack(fill="x", padx=15, pady=10)
        
        # Fecha Inicio
        ttk.Label(frame_date_inputs, text="Desde (AAAA-MM-DD HH:MM:SS):", style='Body.TLabel').grid(row=0, column=0, sticky="w")
        self.entry_start_date = ttk.Entry(frame_date_inputs, width=25, style='Modern.TEntry')
        self.entry_start_date.grid(row=0, column=1, padx=10, pady=5)
        ttk.Label(frame_date_inputs, text="(Vacío = Ahora)", style='Dim.TLabel').grid(row=0, column=2, sticky="w")
        
        # Fecha Fin
        ttk.Label(frame_date_inputs, text="Hasta (AAAA-MM-DD HH:MM:SS):", style='Body.TLabel').grid(row=1, column=0, sticky="w")
        self.entry_end_date = ttk.Entry(frame_date_inputs, width=25, style='Modern.TEntry')
        self.entry_end_date.grid(row=1, column=1, padx=10, pady=5)
        ttk.Label(frame_date_inputs, text="(Vacío = Sin límite antiguo)", style='Dim.TLabel').grid(row=1, column=2, sticky="w")

        # 4. Botones de Acción
        frame_action = ttk.Frame(main_container, style='Main.TFrame')
        frame_action.pack(fill="x", pady=20)
        
        self.btn_start = tk.Button(frame_action, text="INICIAR DESCARGA", command=self.start_scraping,
                                 bg=COLORS['accent'], fg='white', font=('Segoe UI', 11, 'bold'),
                                 activebackground=COLORS['accent_hover'], activeforeground='white',
                                 relief='flat', padx=20, pady=10, cursor='hand2')
        self.btn_start.pack(side="left", fill="x", expand=True, padx=(0, 10))
        
        self.btn_stop = tk.Button(frame_action, text="DETENER", command=self.stop_scraping, state="disabled",
                                bg=COLORS['secondary_bg'], fg='#aaaaaa', font=('Segoe UI', 11, 'bold'),
                                activebackground=COLORS['error'], activeforeground='white',
                                relief='flat', padx=20, pady=10, cursor='hand2')
        self.btn_stop.pack(side="left", fill="x", expand=True, padx=(10, 0))

        # 5. Logs Terminal Style
        lbl_console = ttk.Label(main_container, text="> Log de procesos", style='Body.TLabel')
        lbl_console.pack(anchor="w", pady=(0, 5))
        
        self.log_area = scrolledtext.ScrolledText(main_container, height=10, state='disabled',
                                                bg=COLORS['log_bg'], fg=COLORS['log_fg'],
                                                font=FONTS['mono'], insertbackground='white',
                                                relief='flat', borderwidth=0)
        self.log_area.pack(fill="both", expand=True)

    def setup_styles(self):
        style = ttk.Style()
        style.theme_use('clam') # Clam supports color customization better
        
        # Frames
        style.configure('Main.TFrame', background=COLORS['bg'])
        style.configure('Card.TFrame', background=COLORS['bg'])
        
        # LabelFrames
        style.configure('Card.TLabelframe', background=COLORS['bg'], bordercolor=COLORS['secondary_bg'])
        style.configure('Card.TLabelframe.Label', background=COLORS['bg'], foreground=COLORS['accent'], font=FONTS['sub_header'])
        
        # Labels
        style.configure('Header.TLabel', background=COLORS['bg'], foreground=COLORS['fg'], font=FONTS['header'])
        style.configure('SubHeader.TLabel', background=COLORS['bg'], foreground='#666666', font=('Segoe UI', 14))
        style.configure('Body.TLabel', background=COLORS['bg'], foreground=COLORS['fg'], font=FONTS['body'])
        style.configure('Dim.TLabel', background=COLORS['bg'], foreground='#888888', font=('Segoe UI', 9))
        
        # Entries
        style.configure('Modern.TEntry', fieldbackground=COLORS['entry_bg'], foreground=COLORS['fg'], 
                       insertcolor='black', borderwidth=1, bordercolor='#cccccc', padding=5) # Border for light mode
        
        # Checkbuttons
        style.configure('Modern.TCheckbutton', background=COLORS['bg'], foreground=COLORS['fg'], 
                       font=FONTS['body'], activebackground=COLORS['bg'], indicatorcolor=COLORS['entry_bg'],
                       indicatorrelief='sunken', indicatorborderwidth=1) # Border for check
        style.map('Modern.TCheckbutton',
                  indicatorcolor=[('selected', COLORS['accent'])],
                  background=[('active', COLORS['bg'])])

    def log(self, message):
        self.log_area.config(state='normal')
        self.log_area.insert(tk.END, f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {message}\n")
        self.log_area.see(tk.END)
        self.log_area.config(state='disabled')

    def start_scraping(self):
        subreddit = self.entry_subreddit.get().strip()
        if not subreddit:
            messagebox.showwarning("Falta Información", "Por favor escribe el nombre de la comunidad.")
            return

        if not self.var_posts.get() and not self.var_comments.get():
            messagebox.showwarning("Atención", "Selecciona al menos un tipo de dato (Posts o Comentarios).")
            return

        # Validar fechas
        start_ts = None
        end_ts = None
        
        try:
            s_date = self.entry_start_date.get().strip()
            if s_date:
                dt_obj = datetime.datetime.strptime(s_date, '%Y-%m-%d %H:%M:%S')
                start_ts = int(dt_obj.timestamp())
            
            e_date = self.entry_end_date.get().strip()
            if e_date:
                dt_obj = datetime.datetime.strptime(e_date, '%Y-%m-%d %H:%M:%S')
                end_ts = int(dt_obj.timestamp())
        except ValueError:
            messagebox.showerror("Error de Formato", "El formato de fecha debe ser: YYYY-MM-DD HH:MM:SS")
            return

        self.stop_event.clear()
        self.is_running = True
        self.btn_start.config(state="disabled", text="EJECUTANDO...")
        self.btn_stop.config(state="normal", bg=COLORS['error'], fg='white')
        self.log_area.config(state='normal')
        self.log_area.delete(1.0, tk.END)
        self.log_area.config(state='disabled')
        
        archivo_salida = f"{subreddit}_data.csv"
        
        self.log(f"--- INICIANDO SCRAPER ---")
        self.log(f"Comunidad: r/{subreddit}")
        self.log(f"Destino: {archivo_salida}")
        
        thread = threading.Thread(target=self.run_logic, args=(subreddit, archivo_salida, start_ts, end_ts))
        thread.daemon = True
        thread.start()

    def stop_scraping(self):
        if self.is_running:
            self.log("\n!!! SOLICITUD DE PARADA RECIBIDA... Finalizando bloque actual !!!")
            self.stop_event.set()

    def run_logic(self, subreddit, archivo_salida, start_ts, end_ts):
        try:
            # Si solo quiere comentarios (sin posts), usamos el metodo antiguo (búsqueda global de comentarios)
            # Pero si quiere Posts (y opcionalmente comentarios), usamos el nuevo flujo secuencial.
            if self.var_posts.get():
                self.procesar_secuencial(subreddit, archivo_salida, start_ts, end_ts)
            elif self.var_comments.get():
                # Solo comentarios, sin posts padre -> búsqueda global
                self.descargar_endpoint('comment', subreddit, archivo_salida, start_ts, end_ts)
                
            self.log("\n--- PROCESO FINALIZADO EXITOSAMENTE ---")
            
        except Exception as e:
            self.log(f"ERROR CRÍTICO: {e}")
        finally:
            self.is_running = False
            self.root.after(0, self.reset_buttons)

    def reset_buttons(self):
        self.btn_start.config(state="normal", text="INICIAR DESCARGA")
        self.btn_stop.config(state="disabled", bg=COLORS['secondary_bg'], fg='#aaaaaa')

    def procesar_secuencial(self, subreddit, archivo_salida, start_timestamp, end_timestamp_limit):
        """
        Descarga posts por lotes. Para cada post, descarga sus comentarios inmediatamente.
        """
        url_sub = "https://api.pullpush.io/reddit/search/submission"
        before_timestamp = start_timestamp if start_timestamp else int(time.time())
        
        total_posts = 0
        total_comments = 0
        
        while not self.stop_event.is_set():
            # 1. Obtener Lote de Posts
            params = {
                "subreddit": subreddit,
                "size": 50, # Lotes de 50 para ir procesando
                "before": before_timestamp,
                "sort": "desc",
                "sort_type": "created_utc"
            }
            
            try:
                self.log(f"\n>> Buscando posts antes de {datetime.datetime.fromtimestamp(before_timestamp)}")
                resp = requests.get(url_sub, params=params, timeout=15)
                if resp.status_code != 200:
                    self.log(f"API Posts {resp.status_code}. Esperando...")
                    time.sleep(5)
                    continue
                
                data = resp.json().get('data', [])
                if not data:
                    self.log("No más posts encontrados.")
                    break
                
                # Filtrar fecha limite
                if end_timestamp_limit:
                    data = [item for item in data if item['created_utc'] >= end_timestamp_limit]
                    if not data:
                        self.log("Límite de fecha antigua alcanzado (Posts).")
                        break

                # Procesar cada post en el lote
                for post in data:
                    if self.stop_event.is_set(): break
                    
                    # 1. Guardar Post
                    post_limpio = self.normalizar_datos([post], 'POST')
                    self.guardar_csv(post_limpio, archivo_salida)
                    total_posts += 1
                    
                    # 2. Buscar Comentarios del Post (si está activado)
                    if self.var_comments.get():
                        post_id = post.get('id')
                        title_short = (post.get('title')[:30] + '..') if post.get('title') else 'Sin titulo'
                        self.log(f"Post: {title_short} | Buscando comentarios...")
                        
                        n_comments = self.descargar_comentarios_post(post_id, archivo_salida)
                        total_comments += n_comments
                        
                    # Pequeña pausa entre posts para no saturar
                    time.sleep(0.5)

                # Actualizar timestamp para siguiente lote
                last_ts = resp.json().get('data', [])[-1]['created_utc']
                before_timestamp = last_ts
                
                self.log(f"--- FASE COMPLETADA: {total_posts} Posts, {total_comments} Comments acumulados ---")
                
                if end_timestamp_limit and last_ts <= end_timestamp_limit:
                     self.log("Límite de fecha global alcanzado.")
                     break
                     
            except Exception as e:
                self.log(f"Error en loop principal: {e}")
                time.sleep(5)

    def descargar_comentarios_post(self, link_id, archivo_salida):
        """Descarga todos los comentarios asociados a un link_id específico"""
        url_comm = "https://api.pullpush.io/reddit/search/comment"
        
        # PullPush a veces devuelve todo en una llamada si size es grande, o hay que paginar si es gigante.
        # Por simplicidad para 'scrapping masivo', pedimos hasta 500.
        # Si queremos ser exhaustivos en threads de 5k comentarios, habría que paginar aqui tambien.
        params = {
            "link_id": link_id,
            "size": 500,
            "sort": "desc",
            "sort_type": "created_utc"
        }
        
        try:
            resp = requests.get(url_comm, params=params, timeout=10)
            if resp.status_code == 200:
                data = resp.json().get('data', [])
                if data:
                    clean_data = self.normalizar_datos(data, 'COMENTARIO')
                    self.guardar_csv(clean_data, archivo_salida)
                    return len(data)
        except:
            pass
        return 0

    # Mantenemos este para la opcion "Solo Comentarios" (Legacy Mode) o uso futuro
    def descargar_endpoint(self, endpoint_type, subreddit, archivo_salida, start_timestamp, end_timestamp_limit):
        if self.stop_event.is_set(): return

        url = f"https://api.pullpush.io/reddit/search/{endpoint_type}"
        label = "POSTS" if endpoint_type == 'submission' else "COMENTARIOS"
        
        self.log(f"\n>> Descargando Bloque: {label}")
        
        before_timestamp = start_timestamp if start_timestamp else int(time.time())
        
        buffer = []
        
        while not self.stop_event.is_set():
            params = {
                "subreddit": subreddit,
                "size": 100,
                "before": before_timestamp,
                "sort": "desc",
                "sort_type": "created_utc"
            }
            
            try:
                response = requests.get(url, params=params, timeout=15)
                if response.status_code != 200:
                    self.log(f"API Ocupada ({response.status_code}). Pausa de 5s...")
                    time.sleep(5)
                    continue
                
                data = response.json().get('data', [])
                
                if not data:
                    self.log(f"No hay más datos para {label}.")
                    break
                
                if end_timestamp_limit:
                    data = [item for item in data if item['created_utc'] >= end_timestamp_limit]
                    if not data:
                        self.log(f"Límite de fecha antigua alcanzado para {label}.")
                        break

                datos_limpios = self.normalizar_datos(data, label)
                buffer.extend(datos_limpios)
                
                last_item_ts = response.json().get('data', [])[-1]['created_utc']
                before_timestamp = last_item_ts
                
                if buffer:
                    fecha_last = datos_limpios[-1]['fecha_legible'] if datos_limpios else "..."
                    self.log(f"Buffer Global {label}: {len(buffer)} items (Último: {fecha_last})")
                    self.guardar_csv(buffer, archivo_salida)
                    buffer = [] 
                
                if end_timestamp_limit and last_item_ts <= end_timestamp_limit:
                    break

                time.sleep(1) 
                
            except Exception as e:
                self.log(f"Error conexión: {e}")
                time.sleep(5)
            
    def normalizar_datos(self, data_list, tipo):
        items_procesados = []
        for item in data_list:
            ts = item.get('created_utc')
            fecha_humana = datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S')
            
            row = {
                'tipo_dato': tipo,
                'fecha_legible': fecha_humana,
                'autor': item.get('author'),
                'titulo': item.get('title', ''), 
                'texto_contenido': item.get('body', item.get('selftext', '')),
                'score': item.get('score'),
                'id_item': item.get('id'),
                'link_id': item.get('link_id', item.get('id')),
                'parent_id': item.get('parent_id', ''),
                'timestamp_raw': ts
            }
            items_procesados.append(row)
        return items_procesados

    def guardar_csv(self, lista_dict, archivo_salida):
        if not lista_dict: return
        
        df = pd.DataFrame(lista_dict)
        columnas_orden = ['tipo_dato', 'fecha_legible', 'autor', 'titulo', 'texto_contenido', 'score', 'link_id', 'id_item']
        cols_finales = [c for c in columnas_orden if c in df.columns]
        
        try:
            es_archivo_nuevo = not os.path.isfile(archivo_salida)
            df[cols_finales].to_csv(archivo_salida, mode='a', header=es_archivo_nuevo, index=False, encoding='utf-8-sig')
        except Exception as e:
            self.log(f"Error escribiendo archivo: {e}")

if __name__ == "__main__":
    root = tk.Tk()
    app = RedditScraperGUI(root)
    root.mainloop()