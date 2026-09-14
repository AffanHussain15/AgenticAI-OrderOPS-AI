import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav className="navbar">
      <span className="brand">OrderOps AI</span>
      <div className="nav-links">
        <NavLink to="/" end>
          Place Order
        </NavLink>
        <NavLink to="/admin">Admin Dashboard</NavLink>
      </div>
    </nav>
  )
}
