import { NavLink } from 'react-router-dom'
import { Icon } from './Icons'

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="brand">
        <span className="brand-mark">
          <Icon.bolt width={17} height={17} />
        </span>
        <span>
          OrderOps AI
          <span className="brand-sub">Autonomous Order Triage</span>
        </span>
      </div>
      <div className="nav-links">
        <NavLink to="/" end>
          Place Order
        </NavLink>
        <NavLink to="/admin">Admin Dashboard</NavLink>
      </div>
    </nav>
  )
}
