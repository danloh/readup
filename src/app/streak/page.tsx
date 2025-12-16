'use client';

import StreakPage from './components/StreakPage';
import NavBar from '../NavBar';

export default function Library() {
  return (<NavBar tab={'streak'} >{StreakPage()}</NavBar>);
}
