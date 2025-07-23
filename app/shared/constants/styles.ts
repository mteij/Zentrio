export const formStyles = {
  input: "w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200",
  button: "w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded disabled:bg-gray-500 transition-colors duration-200",
  form: "space-y-4",
  error: "text-sm text-red-500",
  label: "block text-sm font-medium text-gray-300 mb-2",
  container: "min-h-screen bg-gradient-to-br from-black via-gray-900 to-red-900 flex items-center justify-center px-4"
};

export const profileStyles = {
  card: "flex flex-col items-center cursor-pointer group relative transition-all duration-300 hover:scale-105",
  avatar: "rounded-lg profile-avatar flex items-center justify-center text-5xl font-bold bg-gray-700 shadow-lg transition-all duration-300",
  name: "text-lg font-semibold text-white mb-0.5 truncate w-full text-center",
  container: "p-8 min-h-screen",
  grid: "grid gap-8",
  addButton: "border-2 border-dashed border-gray-600 hover:border-gray-500 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:text-gray-300 transition-all duration-300 group",
  editButton: "absolute top-2 right-2 bg-gray-800 bg-opacity-90 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
};

export const emailStyles = {
  colors: {
    primary: '#e50914',
    text: '#333333',
    muted: '#777777',
    background: '#f4f4f4',
    surface: '#ffffff',
    infoBackground: '#f0f0f0'
  },
  spacing: {
    container: '20px',
    content: '30px',
    element: '20px',
    small: '10px'
  },
  borderRadius: {
    container: '8px',
    element: '4px'
  },
  button: {
    display: "inline-block",
    padding: "12px 24px",
    backgroundColor: "#e50914",
    color: "#ffffff",
    textDecoration: "none",
    borderRadius: "4px",
    fontWeight: "bold"
  },
  infoBox: {
    backgroundColor: "#f0f0f0",
    padding: "15px",
    borderRadius: "4px",
    margin: "20px 0"
  }
};

export const animations = {
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,
  slideUp: `
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `
};