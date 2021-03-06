import React from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios'
const Navbar = req => {



    if (localStorage.getItem('user')) {
        return (
            <nav className="navbar bg-dark">
                <h1>
                    <Link to="/"> Brist-Tool</Link>
                </h1>
                <ul>        
              
                    <li><Link to="/logexercise">Log Exercise</Link></li>
                    <li><Link to="/logfood">Log Food</Link></li>
                    <li><Link to="/logstool">Log Stool</Link></li>
                    <li><Link to="/logs"> View Logs</Link></li>
                   <li><a onClick={() => {axios.post('/api/auth/logout')
                        .then(res => window.location.href="/",localStorage.setItem('user',''))
                        .catch((err) => {console.log("Logout FAILED")}) }}>Log Out</a></li>

                </ul>
            </nav>


        )
    }
    else
    {
        return (

            <nav className="navbar bg-dark">
                <h1>
                    <Link to="/"> Brist-Tool</Link>
                </h1>

                <ul>
                    <li><Link to="/register">Register</Link></li>
                    <li><Link to="/login">Login</Link></li>
                </ul>
            </nav>

        )
    }


}
    export default Navbar