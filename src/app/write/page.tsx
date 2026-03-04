'use client';

import WritePage from './components/WritePage';
import NavBar from '../NavBar';

export default function Write() {
  return (<NavBar tab={''} >{WritePage()}</NavBar>);
}
