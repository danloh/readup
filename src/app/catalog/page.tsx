'use client';

import OpdsPage from './components/OpdsPage';
import NavBar from '../NavBar';

export default function Opds() {
  return (<NavBar tab={'catalog'} >{OpdsPage()}</NavBar>);
}
