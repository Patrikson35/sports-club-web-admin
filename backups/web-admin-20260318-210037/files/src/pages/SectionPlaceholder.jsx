function SectionPlaceholder({ title, description }) {
  return (
    <div>
      <div className="page-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="card">
        <p style={{ color: 'var(--text-secondary)' }}>
          Táto sekcia je pripravená v menu podľa oprávnení roly.
        </p>
      </div>
    </div>
  )
}

export default SectionPlaceholder
